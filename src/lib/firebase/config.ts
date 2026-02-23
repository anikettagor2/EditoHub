import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
    initializeFirestore,
    getFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: process.env.EDITOHUB_FIREBASE_API_KEY || "dummy-api-key",
    authDomain: process.env.EDITOHUB_FIREBASE_AUTH_DOMAIN || "dummy-auth-domain",
    projectId: process.env.EDITOHUB_FIREBASE_PROJECT_ID || "dummy-project-id",
    storageBucket: process.env.EDITOHUB_FIREBASE_STORAGE_BUCKET || "dummy-storage-bucket",
    messagingSenderId: process.env.EDITOHUB_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender-id",
    appId: process.env.EDITOHUB_FIREBASE_APP_ID || "dummy-app-id"
};

// Initialize Firebase
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with specialized settings
export const db = getApps().length > 0
    ? getFirestore(app)
    : initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        }),
        experimentalForceLongPolling: true,
    });

export const storage = getStorage(app);
export const functions = getFunctions(app);
