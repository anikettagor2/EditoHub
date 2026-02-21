import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    const config: admin.AppOptions = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    };

    if (privateKey && clientEmail) {
        config.credential = admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'), // Handle newline characters in string
        });
    } else {
        // Fallback for local development if GOOGLE_APPLICATION_CREDENTIALS is set
        config.credential = admin.credential.applicationDefault();
    }

    admin.initializeApp(config);
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
