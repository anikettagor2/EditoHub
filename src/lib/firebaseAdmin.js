import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

if (getApps().length === 0) {
    const projectId = process.env.EDITOHUB_PROJECT_ID;
    const clientEmail = process.env.EDITOHUB_CLIENT_EMAIL;
    const privateKey = (process.env.EDITOHUB_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    console.log(`[Firebase Admin] Initializing for project: ${projectId}`);
    console.log(`[Firebase Admin] Using client email: ${clientEmail}`);

    if (!privateKey) {
        console.error("[Firebase Admin] CRITICAL: Private key is missing!");
    }

    initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        storageBucket: process.env.EDITOHUB_FIREBASE_STORAGE_BUCKET,
    });
}

export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();
