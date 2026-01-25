'use server';

import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { UserRole } from '@/types/schema';
import { revalidatePath } from 'next/cache';

/**
 * Deletes a user from Firebase Auth and Firestore
 * @param uid The user's ID
 */
export async function deleteUser(uid: string) {
    try {
        // 1. Delete from Firebase Auth
        try {
            await adminAuth.deleteUser(uid);
        } catch (authError: any) {
            console.warn(`Auth deletion skipped for ${uid}:`, authError.code);
            // Continue if user is already missing in Auth
            if (authError.code !== 'auth/user-not-found') {
                throw authError;
            }
        }

        // 2. Delete from Firestore
        await adminDb.collection('users').doc(uid).delete();

        // 3. Optional: Delete their storage folder? 
        // This is risky if they shared files, but for strict cleanup:
        // await adminStorage.bucket().deleteFiles({ prefix: `users/${uid}/` });

        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting user:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deletes a project and its associated data
 * @param projectId The project ID
 */
export async function deleteProject(projectId: string) {
    try {
        // 1. Delete the project document
        await adminDb.collection('projects').doc(projectId).delete();

        // 2. Delete subcollections (recursively is hard in standard API, 
        // usually we just leave them or use a recursive helper. 
        // For now, we'll just delete the top level doc as standard practice for basic cleanup)

        // Note: For a production app, you'd use a cloud function to recursively delete
        // comments and revisions.

        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting project:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates a project's details
 */
export async function updateProject(projectId: string, data: any) {
    try {
        await adminDb.collection('projects').doc(projectId).update({
            ...data,
            updatedAt: Date.now()
        });
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Assigns an editor to a project
 */
export async function assignEditor(projectId: string, editorId: string) {
    try {
        // Get the project to check current members
        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectSnap = await projectRef.get();

        if (!projectSnap.exists) throw new Error("Project not found");

        const projectData = projectSnap.data();
        let members = projectData?.members || [];

        // Remove old editor if exists (optional logic, depends on requirement)
        // Add new editor to members if not present
        if (!members.includes(editorId)) {
            members.push(editorId);
        }

        await projectRef.update({
            assignedEditorId: editorId,
            assignmentStatus: 'pending',
            status: 'pending_assignment', // Waiting for acceptance
            members: members,
            updatedAt: Date.now()
        });

        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Handles editor acceptance or rejection
 */
export async function respondToAssignment(projectId: string, response: 'accepted' | 'rejected') {
    try {
        await adminDb.collection('projects').doc(projectId).update({
            assignmentStatus: response,
            status: response === 'accepted' ? 'active' : 'pending_assignment', // Revert to pending if rejected? Or stay separate?
            updatedAt: Date.now()
        });
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all users for the admin table
 * (Can also be done client-side, but server-side ensures we bypass RLS if strict)
 */
export async function getAllUsers() {
    try {
        const usersSnap = await adminDb.collection('users').get();
        const users = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        return { success: true, data: users };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
