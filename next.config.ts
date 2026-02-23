import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    EDITOHUB_FIREBASE_API_KEY: process.env.EDITOHUB_FIREBASE_API_KEY,
    EDITOHUB_FIREBASE_AUTH_DOMAIN: process.env.EDITOHUB_FIREBASE_AUTH_DOMAIN,
    EDITOHUB_FIREBASE_PROJECT_ID: process.env.EDITOHUB_FIREBASE_PROJECT_ID,
    EDITOHUB_FIREBASE_STORAGE_BUCKET: process.env.EDITOHUB_FIREBASE_STORAGE_BUCKET,
    EDITOHUB_FIREBASE_MESSAGING_SENDER_ID: process.env.EDITOHUB_FIREBASE_MESSAGING_SENDER_ID,
    EDITOHUB_FIREBASE_APP_ID: process.env.EDITOHUB_FIREBASE_APP_ID,
    EDITOHUB_RAZORPAY_KEY_ID: process.env.EDITOHUB_RAZORPAY_KEY_ID,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
