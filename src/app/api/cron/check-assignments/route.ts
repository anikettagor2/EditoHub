import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { notifyPMEditorRejected } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Optional: Verify authorization header for cron job security 
        // e.g. checking process.env.CRON_SECRET

        const now = Date.now();
        
        // Find all projects with pending assignment that have expired
        const projectsRef = adminDb.collection('projects');
        const expiredQuery = projectsRef
            .where('assignmentStatus', '==', 'pending')
            .where('assignmentExpiresAt', '<=', now);

        const snapshot = await expiredQuery.get();

        if (snapshot.empty) {
            return NextResponse.json({ success: true, message: 'No expired assignments found', processed: 0 });
        }

        const batch = adminDb.batch();
        let processedCount = 0;

        for (const doc of snapshot.docs) {
            const projectData = doc.data();
            const projectId = doc.id;
            
            // 1. Update project document
            batch.update(doc.ref, {
                assignmentStatus: 'expired',
                status: 'pending_assignment',
                editorDeclineReason: 'Assignment expired - no response within 15 minutes',
                assignedEditorId: admin.firestore.FieldValue.delete(),
                editorPrice: admin.firestore.FieldValue.delete(),
                assignmentAt: admin.firestore.FieldValue.delete(),
                assignmentExpiresAt: admin.firestore.FieldValue.delete(),
                updatedAt: now
            });

            // 2. Add Notification for PM
            const expiredPmId = projectData?.assignedPMId;
            if (expiredPmId) {
                let expiredEditorName = 'Editor';
                if (projectData?.assignedEditorId) {
                    const expiredEditorSnap = await adminDb.collection('users').doc(projectData.assignedEditorId).get();
                    if (expiredEditorSnap.exists) {
                        expiredEditorName = expiredEditorSnap.data()?.displayName || 'Editor';
                    }
                }

                // In-app notification
                const expiredNotifRef = adminDb.collection('notifications').doc();
                batch.set(expiredNotifRef, {
                    id: expiredNotifRef.id,
                    userId: expiredPmId,
                    type: 'project_rejected',
                    title: `${projectData?.name || 'Project'} - Assignment Timed Out`,
                    message: `${expiredEditorName} did not respond within 15 minutes. Please reassign the project.`,
                    projectId,
                    editorName: expiredEditorName,
                    reason: 'No response within 15 minutes',
                    read: false,
                    link: `/dashboard?project=${projectId}`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Send WhatsApp via pro_delay template
                // Don't wait for batch to commit for WhatsApp, do it directly
                void notifyPMEditorRejected(projectId, expiredPmId, expiredEditorName, 'No response within 15 minutes')
                    .catch(err => console.error('[Cron] Failed to send WhatsApp notification:', err));
            }

            processedCount++;
        }

        await batch.commit();

        return NextResponse.json({ 
            success: true, 
            message: `Successfully processed ${processedCount} expired assignments`,
            processed: processedCount
        });

    } catch (error: any) {
        console.error('Error processing expired assignments:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
