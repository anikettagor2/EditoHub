'use server';

import { notifyClientOfStatusUpdate } from "@/lib/whatsapp";
import { db } from "@/lib/firebaseAdmin";
import { revalidatePath } from "next/cache";

/**
 * Triggered by the client-side upload page once a revision is successfully saved.
 * Also updates project status to 'in_review'.
 */
export async function handleRevisionUploaded(projectId: string) {
    try {
        // 1. Update project status to 'in_review'
        await db.collection('projects').doc(projectId).update({
            status: 'in_review',
            updatedAt: Date.now()
        });

        // 2. Notify client
        await notifyClientOfStatusUpdate(projectId, 'in_review');

        revalidatePath(`/dashboard/projects/${projectId}`);
        return { success: true };
    } catch (error: any) {
        console.error("Error handling revision upload notification:", error);
        return { success: false, error: error.message };
    }
}
