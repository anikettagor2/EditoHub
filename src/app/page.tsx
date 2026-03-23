"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { Hero } from "@/components/home/hero";
import { StickyScroll } from "@/components/home/sticky-scroll";
import { BeforeAfter } from "@/components/home/before-after";
import { ParallaxGallery } from "@/components/home/parallax-gallery";
import { ScrollText } from "@/components/home/scroll-text";
import { FuturisticCTA } from "@/components/futuristic-cta";
import { CustomCursor } from "@/components/home/custom-cursor";
import { ImmersiveBackground } from "@/components/home/immersive-background";
import { EditingTimeline } from "@/components/home/editing-timeline";

export default function Home() {
  return (
    <LenisProvider>
      <main className="premium-light-bg text-zinc-900 overflow-x-hidden selection:bg-primary selection:text-white relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-linear-to-b from-white/60 to-transparent z-0" />
        <CustomCursor />
        <ImmersiveBackground />
        <Navbar />

        <Hero />

        <div className="premium-light-divider" />
        <ScrollText />

        <div className="premium-light-divider" />
        <StickyScroll />

        <div className="premium-light-divider" />
        <EditingTimeline />

        <div className="premium-light-divider" />
        <BeforeAfter />

        <div className="premium-light-divider" />
        <ParallaxGallery />

        <div className="premium-light-divider" />
        <FuturisticCTA />

        <Footer />
      </main>
    </LenisProvider>
  );
}
