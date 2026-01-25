import Razorpay from 'razorpay';

if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
    // Fallback for development if env not set, though env is preferred
    console.warn("Razorpay Key ID not found in environment variables");
}

export const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const CURRENCY = 'INR';
