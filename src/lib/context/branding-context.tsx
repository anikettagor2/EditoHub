"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

interface BrandingContextType {
    logoUrl: string | null;
    isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextType>({
    logoUrl: null,
    isLoading: true,
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "settings", "branding"), (snapshot) => {
            if (snapshot.exists()) {
                setLogoUrl(snapshot.data().logoUrl || null);
            } else {
                setLogoUrl(null);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching branding:", error);
            setIsLoading(false);
        });

        return () => unsub();
    }, []);

    return (
        <BrandingContext.Provider value={{ logoUrl, isLoading }}>
            {children}
        </BrandingContext.Provider>
    );
}

export const useBranding = () => useContext(BrandingContext);
