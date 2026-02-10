
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  reauthenticateWithPopup,
  signInWithEmailAndPassword
} from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User, UserRole } from "@/types/schema";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: (role?: UserRole) => Promise<void>;
  loginAsAdmin: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  signInWithGoogle: async () => {},
  loginAsAdmin: async () => {},
  loginWithEmail: async () => {},
  logout: async () => {},
  deleteAccount: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        // Fetch user profile from Firestore
        const userRef = doc(db, "users", fbUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUser(userSnap.data() as User);
        } else {
            // New users are handled in signInWithGoogle usually, 
            // but if they exist in Auth but not Firestore (rare edge case), 
            // we'll handle it there or let them be 'guest'
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (selectedRole: UserRole = 'client') => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Create new user profile with selected role
        const newUser: User = {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            role: selectedRole,
            createdAt: Date.now(),
        };
        await setDoc(userRef, newUser);
        setUser(newUser);
      } else {
        // Existing user: Verify Role
        const existingData = userSnap.data() as User;
        
        // STRICT ROLE ENFORCEMENT
        // If the existing role doesn't match the role the user is trying to log in as, deny access.
        if (existingData.role !== selectedRole && existingData.role !== 'admin') { 
            // Allow admin to sign in regardless of selected role if needed, or stick to strict.
            // Actually, for this request, admin is handled separately now.
            
            if (existingData.role !== selectedRole) {
                 await signOut(auth);
                 setUser(null);
                 setFirebaseUser(null);
                 throw new Error(`This account is already registered as a ${existingData.role}. Please log in as a ${existingData.role}.`);
            }
        }

        setUser(existingData);
      }
      
      router.push("/dashboard");

    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
      // Check for static admin credentials and map to real ones
      // Allow both short username and full email if password matches '1234'
      const normalizedEmail = email.trim().toLowerCase();
      if ((normalizedEmail === "admin@editohub" || normalizedEmail === "admin@editohub.com") && (password.trim() === "1234" || password.trim() === "admin1234")) {
          await loginAsAdmin();
          return;
      }

      try {
          await signInWithEmailAndPassword(auth, email, password);
          router.push("/dashboard");
      } catch (error: any) {
          console.error("Error signing in with Email/Pass", error);
          
          // Enhanced Admin Recovery: If login fails for admin email, try ensuring it exists
          if (
              (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') &&
              (email.trim().toLowerCase() === "admin@editohub.com" || email.trim().toLowerCase() === "admin@editohub")
          ) {
              console.log("Admin login failed, attempting to ensure admin account...");
              try {
                  await loginAsAdmin();
                  return;
              } catch (adminError) {
                  // If enhanced recovery fails, throw original error
                  throw error;
              }
          }

          throw error;
      }
  };
  
  const loginAsAdmin = async () => {
     try {
         // Call server API to ensure "admin@editohub.com" exists with correct password
         await fetch('/api/admin/ensure-admin', { method: 'POST' });

         // Now sign in with the verified credentials
         await signInWithEmailAndPassword(auth, "admin@editohub.com", "admin1234");
         router.push("/dashboard");

     } catch (error: any) {
         console.error("Admin login failed:", error);
         throw error;
     }
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) return;
    try {
        const uid = auth.currentUser.uid;
        // 1. Delete Firestore Data (Mark as deleted or actual delete)
        await setDoc(doc(db, "users", uid), { deleted: true, deletedAt: Date.now() }, { merge: true });
        
        // 2. Delete Auth User
        await auth.currentUser.delete();
        
        // 3. Reset State
        setUser(null);
        setFirebaseUser(null);
        router.push("/");
    } catch (error: any) {
        if (error.code === 'auth/requires-recent-login') {
            try {
                // Determine provider - assuming Google for now as main auth
                // Ideally check auth.currentUser.providerData[0].providerId
                const provider = new GoogleAuthProvider();
                await reauthenticateWithPopup(auth.currentUser, provider);
                
                // Retry delete after successful re-auth
                await auth.currentUser.delete();
                
                setUser(null);
                setFirebaseUser(null);
                router.push("/");
                return;
            } catch (reAuthError) {
                console.error("Re-authentication failed or cancelled:", reAuthError);
                throw reAuthError;
            }
        }
        console.error("Error deleting account:", error);
        throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem("editohub_admin_session");
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
    router.push("/");
  };



  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, loginAsAdmin, loginWithEmail, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}
