import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            projectId,
            amount,
            paymentType
        } = body;

        console.log("Verifying payment for project:", projectId, "Amount:", amount);

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !projectId) {
            console.error("Missing fields in verification request");
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            console.error("RAZORPAY_KEY_SECRET is not set in environment variables");
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            console.error("Signature mismatch. Generated:", generated_signature, "Received:", razorpay_signature);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        // Prepare Update Data using Admin SDK
        const updateData: any = {
            amountPaid: FieldValue.increment(amount), // Admin SDK syntax
            razorpayPaymentId: razorpay_payment_id,
            updatedAt: Date.now()
        };

        if (paymentType === 'initial') {
            updateData.status = 'pending_assignment';
            updateData.paymentStatus = 'half_paid';
        } else if (paymentType === 'final') {
            updateData.status = 'completed';
            updateData.paymentStatus = 'full_paid';
        }

        console.log("Updating project with:", updateData);

        // Perform Update using Admin SDK (Bypasses rules)
        await adminDb.collection('projects').doc(projectId).update(updateData);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Verification Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
