'use server';

import { notifyClient } from "@/lib/whatsapp";
import { adminDb } from "@/lib/firebase/admin";
import { revalidatePath } from "next/cache";

/**
 * Triggered by the client-side upload page once a revision is successfully saved.
 * Also updates project status to 'in_review'.
 */
export async function handleRevisionUploaded(projectId: string) {
    try {
        // 1. Update project status to 'in_review'
        await adminDb.collection('projects').doc(projectId).update({
            status: 'in_review',
            updatedAt: Date.now()
        });

        // 2. Notify client with review link
        const reviewLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://editohub.com'}/dashboard/projects/${projectId}/review`;
        await notifyClient(projectId, 'PROPOSAL_UPLOADED', { reviewLink });

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };
    } catch (error: any) {
        console.error("Error handling revision upload notification:", error);
        return { success: false, error: error.message };
    }
}
