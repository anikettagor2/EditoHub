"use client";

import { Button } from "./ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import { Play } from "lucide-react";
import { useRef } from "react";
import Link from "next/link";
import { useContact } from "@/providers/contact-provider";

export function Hero() {
  const containerRef = useRef(null);
  const { scrollY } = useScroll();
  const { openContact } = useContact();

  // Parallax effects
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);
  const textY = useTransform(scrollY, [0, 500], [0, 100]);

  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Elements - With Parallax */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background z-0" />
      
      <motion.div 
        style={{ y: y1 }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse" 
      />
      <motion.div 
        style={{ y: y2 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px] animate-pulse delay-75" 
      />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 opacity-20" />

      <div className="container relative z-10 px-6 text-center">
        <motion.div
          style={{ y: textY }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8 max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium tracking-wide mb-4"
          >
            PREMIUM VIDEO EDITING AGENCY
          </motion.div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold font-heading tracking-tight leading-tight">
            Crafting <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500 glow-text">Cinematic</span> <br className="hidden md:block" />
            Digital Experiences
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We transform raw footage into high-converting visual masterpieces. 
            Strictly for creators and brands who demand the best.
          </p>

          <motion.div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button size="lg" className="min-w-[180px]" onClick={openContact}>
              Get Started
            </Button>
            <Link href="#work">
              <Button size="lg" variant="outline" className="min-w-[180px] group">
                <Play className="w-4 h-4 mr-2 fill-primary group-hover:fill-primary/80" />
                View Work
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
      
      {/* Scroll Indicator */}
      <motion.div 
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-muted-foreground"
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        style={{ opacity: useTransform(scrollY, [0, 100], [1, 0]) }}
      >
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2">
            <div className="w-1 h-3 bg-white/50 rounded-full" />
        </div>
      </motion.div>
    </section>
  );
}
