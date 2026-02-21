'use server';

import { adminDb } from "@/lib/firebase/admin";
import { Revision, Project } from "@/types/schema";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Registers a download attempt for a revision, enforcing a download limit.
 */
export async function registerDownload(projectId: string, revisionId: string) {
    try {
        const docRef = adminDb.collection('revisions').doc(revisionId);
        const snap = await docRef.get();

        if (!snap.exists) {
            return { success: false, error: "Revision not found" };
        }

        const data = snap.data() as Revision;
        const currentCount = data.downloadCount || 0;

        // If limit reached, mark as archived and return error
        if (currentCount >= 3) {
            if (data.status !== 'archived') {
                await docRef.update({
                    status: 'archived',
                    description: (data.description || "") + " [Download Limit Reached]"
                });
            }
            return { success: false, error: "Download limit reached for this revision." };
        }

        // Increment count
        await docRef.update({
            downloadCount: currentCount + 1
        });

        // Return the stored video URL directly (no signing required)
        const downloadUrl = data.videoUrl || "";

        if (!downloadUrl) {
            return { success: false, error: "No video file found for this revision." };
        }

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true, count: currentCount + 1, remaining: 3 - (currentCount + 1), downloadUrl };

    } catch (error: any) {
        console.error("Register download error:", error);
        return { success: false, error: error.message };
    }
}


import { notifyClientOfStatusUpdate } from "@/lib/whatsapp";

/**
 * Marks a project as paid/deferred based on user's Pay Later status.
 * This function bypasses payment processors.
 */
/**
 * Unlocks project downloads manually (Admin/PM override).
 */
export async function unlockProjectDownloads(projectId: string, userId: string) {
    try {
        // Verify user has permission
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return { success: false, error: "User not found" };
        }

        const userData = userDoc.data();
        const allowedRoles = ['admin', 'project_manager'];

        if (!allowedRoles.includes(userData?.role)) {
            return { success: false, error: "Unauthorized: Only Admins or Project Managers can unlock downloads." };
        }

        await adminDb.collection('projects').doc(projectId).update({
            paymentStatus: 'full_paid',
            status: 'completed',
            downloadsUnlocked: true,
            downloadUnlockRequested: false,
            notes: FieldValue.arrayUnion(`Downloads unlocked by ${userData?.email} (${userData?.role}) at ${new Date().toISOString()}`)
        });

        // Notify client that project is completed/ready for download
        await notifyClientOfStatusUpdate(projectId, 'completed');

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Called by a Pay Later client to request download unlock from their PM.
 * Sets downloadUnlockRequested = true on the project document.
 */
export async function requestDownloadUnlock(projectId: string, userId: string) {
    try {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) return { success: false, error: "User not found" };

        const project = await adminDb.collection('projects').doc(projectId).get();
        if (!project.exists) return { success: false, error: "Project not found" };

        const projectData = project.data();

        // Allow any user who is the client, owner, or a member of the project
        const isProjectMember =
            projectData?.clientId === userId ||
            projectData?.ownerId === userId ||
            (Array.isArray(projectData?.members) && projectData.members.includes(userId));

        if (!isProjectMember) {
            return { success: false, error: "Unauthorized: You are not a member of this project." };
        }

        await adminDb.collection('projects').doc(projectId).update({
            downloadUnlockRequested: true,
            updatedAt: Date.now()
        });

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
/**
 * Creates a new project and notifies the client.
 */
export async function createProject(data: Omit<Project, 'id'>) {
    try {
        const docRef = await adminDb.collection('projects').add({
            ...data,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        const projectId = docRef.id;

        // Notify client that we've received the project
        try {
            await notifyClientOfStatusUpdate(projectId, 'pending_assignment');
            console.log(`[WhatsApp] Auto-notified client for project creation: ${projectId}`);
        } catch (waError) {
            console.error("[WhatsApp] Failed to send creation notification:", waError);
        }

        revalidatePath('/dashboard');
        return { success: true, id: projectId };
    } catch (error: any) {
        console.error("Create project error:", error);
        return { success: false, error: error.message };
    }
}
