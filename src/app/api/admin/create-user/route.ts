
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, displayName, role, createdBy } = body;

        if (!email || !password || !displayName || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate Role
        const validRoles = ['admin', 'manager', 'editor', 'client', 'sales_executive', 'project_manager'];
        if (!validRoles.includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        // 1. Create User in Firebase Auth
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName,
        });

        // 2. Create User Profile in Firestore
        await adminDb.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName,
            role: role,
            photoURL: null,
            createdAt: Date.now(),
            createdBy: createdBy || 'admin',
            initialPassword: password // Storing temporarily for admin visibility (Security Warning: Ideally don't do this in Prod)
        });

        // 3. Set Custom Claim
        await adminAuth.setCustomUserClaims(userRecord.uid, { role: role });

        return NextResponse.json({
            success: true,
            uid: userRecord.uid,
            message: `${role} created successfully`
        });

    } catch (error: any) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create user' },
            { status: 500 }
        );
    }
}
