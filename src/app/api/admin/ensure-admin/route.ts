
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST() {
    try {
        const email = 'admin@editohub.com';
        const displayName = 'Super Admin';
        const password = 'admin1234';

        let userRecord;
        try {
            userRecord = await adminAuth.getUserByEmail(email);
        } catch (error: any) {
            if (error.code !== 'auth/user-not-found') throw error;
        }

        if (userRecord) {
            // Update existing user with correct password
            await adminAuth.updateUser(userRecord.uid, {
                password: password
            });
            // Ensure custom claim
            await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
        } else {
            // Create user
            userRecord = await adminAuth.createUser({
                email,
                password,
                displayName,
            });
            // Set custom claim
            await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
        }

        // Ensure Firestore document
        await adminDb.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName,
            role: 'admin',
            photoURL: null,
            createdAt: Date.now()
        }, { merge: true });

        return NextResponse.json({ success: true, message: 'Admin account ensured.' });

    } catch (error: any) {
        console.error("Failed to ensure admin:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
