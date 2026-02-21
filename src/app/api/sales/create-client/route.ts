
import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, displayName, createdBy, customRates, allowedFormats, phoneNumber } = body;

        if (!email || !password || !displayName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create User in Firebase Auth
        const userRecord = await auth.createUser({
            email,
            password,
            displayName,
            phoneNumber: phoneNumber ? `+91${phoneNumber}` : undefined
        });

        // 2. Create User Profile in Firestore
        await db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName,
            role: 'client',
            phoneNumber: phoneNumber || null,
            photoURL: null,
            createdAt: Date.now(),
            createdBy: createdBy || 'system',
            managedBy: createdBy || null,
            initialPassword: password, // Store for Sales Exec to view/share
            customRates: customRates || null,
            allowedFormats: allowedFormats || null
        });

        // 3. Set Custom Claim (optional but good for Security Rules)
        await auth.setCustomUserClaims(userRecord.uid, { role: 'client' });

        return NextResponse.json({
            success: true,
            uid: userRecord.uid,
            message: 'Client created successfully'
        });

    } catch (error: any) {
        console.error('Error creating client:', error);

        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json(
                { error: 'This email is already registered. Please use a different email.' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Failed to create client' },
            { status: 500 }
        );
    }
}
