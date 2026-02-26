
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    const serviceAccountEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    console.log(`[Firebase Admin] Initializing for project: ${projectId}`);

    if (serviceAccountEmail && privateKey) {
        console.log(`[Firebase Admin] Using Service Account: ${serviceAccountEmail}`);

        // Sanitize the private key: remove quotes and handle newlines
        const sanitizedKey = privateKey
            .trim()
            .replace(/^["']|["']$/g, '') // Remove wrapping quotes if they exist
            .replace(/\\n/g, '\n');      // Convert actual \n strings to real newlines

        console.log(`[Firebase Admin] Private key length: ${sanitizedKey.length} chars`);

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId,
                clientEmail: serviceAccountEmail,
                privateKey: sanitizedKey,
            }),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        });
    } else {
        console.warn(`[Firebase Admin] Missing Service Account credentials.`);
        if (!serviceAccountEmail) console.warn(` - Missing: FIREBASE_CLIENT_EMAIL`);
        if (!privateKey) console.warn(` - Missing: FIREBASE_PRIVATE_KEY`);

        console.warn(`Falling back to Application Default.`);
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: projectId,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        });
    }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
