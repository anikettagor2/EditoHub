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
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase (singleton pattern)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with specialized settings for better connectivity and offline support
let dbInstance;
try {
    // If it's already initialized, just get it
    dbInstance = getFirestore(app);
} catch (e) {
    // Determine persistence type based on environment
    // Multiple tabs in development can sometimes trigger 'Unexpected state (ID: ca9)' due to HMR
    const isDev = process.env.NODE_ENV === 'development';
    
    dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: isDev 
                ? undefined // Default to single tab in dev to avoid 'ca9' race conditions
                : persistentMultipleTabManager()
        })
    });
}

export const db = dbInstance;

export const storage = getStorage(app);
export const functions = getFunctions(app);
