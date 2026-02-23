import Razorpay from 'razorpay';

if (!process.env.EDITOHUB_RAZORPAY_KEY_ID) {
    // Fallback for development if env not set, though env is preferred
    console.warn("Razorpay Key ID not found in environment variables");
}

export const razorpay = new Razorpay({
    key_id: process.env.EDITOHUB_RAZORPAY_KEY_ID || 'rzp_test_dummy',
    key_secret: process.env.EDITOHUB_RAZORPAY_KEY_SECRET || 'dummy_secret',
});

export const CURRENCY = 'INR';
