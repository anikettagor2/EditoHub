
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Trigger: When a new comment is added
export const onCommentCreated = functions.firestore
    .document("projects/{projectId}/comments/{commentId}")
    .onCreate(async (snap, context) => {
        const comment = snap.data();
        const projectId = context.params.projectId;

        // 1. Get Project Details
        const projectRef = admin.firestore().collection("projects").doc(projectId);
        const projectSnap = await projectRef.get();
        const project = projectSnap.data();

        if (!project) return;

        // 2. Notify Project Members (Email / In-App)
        const members = project.members || [];

        // Filter out the comment author
        const recipients = members.filter((uid: string) => uid !== comment.userId);

        console.log(`Sending notifications to: ${recipients.join(", ")} for new comment on ${project.name}`);

        // Example: Create notification records in Firestore
        const batch = admin.firestore().batch();

        recipients.forEach((uid: string) => {
            const notifRef = admin.firestore().collection("users").doc(uid).collection("notifications").doc();
            batch.set(notifRef, {
                type: "comment",
                title: "New Comment",
                message: `${comment.userName} commented on ${project.name}`,
                link: `/dashboard/projects/${projectId}/review/${comment.revisionId}`,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
    });

// Trigger: When a project status changes
export const onProjectStatusChanged = functions.firestore
    .document("projects/{projectId}")
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        if (newData.status !== oldData.status) {
            // Status changed logic (e.g., if Approved, generate final download link)
            console.log(`Project ${context.params.projectId} status changed to ${newData.status}`);
        }
    });
