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
    apiKey: "AIzaSyBnrX9Q1wxDitXOT37_ftMN3rQWsOY6Ikk",
    authDomain: "studio-4633365007-23d80.firebaseapp.com",
    projectId: "studio-4633365007-23d80",
    storageBucket: "studio-4633365007-23d80.firebasestorage.app",
    messagingSenderId: "707194789184",
    appId: "1:707194789184:web:0908252c6107bd67432ea5"
};

// Initialize Firebase (singleton pattern)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with specialized settings for better connectivity and offline support
export const db = getApps().length > 0
    ? getFirestore(app)
    : initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        }),
        experimentalForceLongPolling: true, // Helps with "Could not reach backend" errors
    });

export const storage = getStorage(app);
export const functions = getFunctions(app);
