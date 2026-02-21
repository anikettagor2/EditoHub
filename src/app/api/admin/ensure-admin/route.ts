
import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebaseAdmin';

export async function POST() {
    try {
        const email = 'admin@editohub.com';
        const displayName = 'Super Admin';
        const password = 'admin1234';

        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch (error: any) {
            if (error.code !== 'auth/user-not-found') throw error;
        }

        if (userRecord) {
            // Update existing user with correct password
            await auth.updateUser(userRecord.uid, {
                password: password
            });
            // Ensure custom claim
            await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
        } else {
            // Create user
            userRecord = await auth.createUser({
                email,
                password,
                displayName,
            });
            // Set custom claim
            await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
        }

        // Ensure Firestore document
        await db.collection('users').doc(userRecord.uid).set({
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
