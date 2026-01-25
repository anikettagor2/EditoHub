import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EditoHub | Premium Video Editing Agency",
  description: "Transform your raw footage into cinematic masterpieces. Professional video editing, scriptwriting, and thumbnail design.",
};

import { SmoothScroll } from "@/components/smooth-scroll";
import { ContactProvider } from "@/providers/contact-provider";
import { ContactModal } from "@/components/contact-modal";
import { Providers } from "./providers";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          poppins.variable,
          "antialiased bg-background text-foreground min-h-screen selection:bg-primary/20 selection:text-primary font-sans"
        )}
      >
        <Providers>
          <ContactProvider>
             <SmoothScroll />
             <ContactModal />
             <Toaster position="top-center" richColors />
             {children}
          </ContactProvider>
        </Providers>
      </body>
    </html>
  );
}
