"use client";

import { AuthProvider } from "@/lib/context/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandingProvider } from "@/lib/context/branding-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <BrandingProvider>
          {children}
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
