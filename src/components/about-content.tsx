"use client";

import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { Target, Lightbulb, Quote } from "lucide-react";

export function AboutContent() {
  return (
    <div className="container mx-auto px-6 pb-20 space-y-32 relative">
      {/* Hero / Story */}
      <section className="text-center max-w-4xl mx-auto space-y-8 relative z-10">
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium tracking-wide mb-4"
        >
            OUR STORY
        </motion.div>
        
        <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold font-heading tracking-tight"
        >
            Redefining <span className="text-primary">Creative</span> Standards
        </motion.h1>
        
        <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-muted-foreground leading-relaxed"
        >
            EditoHub began with a simple mission: to bridge the gap between technical editing and creative storytelling. 
            We recognized that content creators didn't just need cuts and transitions; they needed a partner 
            who understood pace, emotion, and retention. Today, we are that partner for brands worldwide.
        </motion.p>
      </section>

      {/* Mission & Vision */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-10 rounded-3xl bg-card border border-white/5 hover:border-primary/20 transition-all duration-300"
          >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                  <Target className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-4 font-heading">Our Mission</h3>
              <p className="text-muted-foreground leading-relaxed">
                  To empower creators and brands by delivering cinematic, high-retention video content that drives real engagement and growth.
              </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="p-10 rounded-3xl bg-card border border-white/5 hover:border-primary/20 transition-all duration-300"
          >
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 mb-6">
                  <Lightbulb className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-4 font-heading">Our Vision</h3>
              <p className="text-muted-foreground leading-relaxed">
                  To become the global standard for remote video production, where quality meets speed and creativity knows no bounds.
              </p>
          </motion.div>
      </section>

      {/* Founder Section */}
      <section className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col lg:flex-row items-center gap-12 bg-gradient-to-br from-secondary/50 to-black p-8 md:p-12 rounded-[2rem] border border-white/10 overflow-hidden"
          >
             {/* Decorative */}
             <div className="absolute top-0 right-0 p-32 bg-primary/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />

             {/* Image Placeholder */}
             <div className="w-full lg:w-1/3 aspect-[4/5] bg-neutral-900 rounded-2xl relative overflow-hidden shrink-0 group">
                 <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-black text-neutral-700 font-bold text-6xl select-none group-hover:scale-105 transition-transform duration-500">
                    DY
                 </div>
                 {/* Simulate 'Cinematic' Overlay */}
                 <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-50 mix-blend-overlay" />
             </div>

             <div className="w-full lg:w-2/3 space-y-8 relative z-10">
                 <div>
                     <h2 className="text-4xl md:text-5xl font-bold font-heading mb-2">Divyanshu Yadav</h2>
                     <p className="text-xl text-primary font-medium tracking-wide">Founder & CEO</p>
                 </div>
                 
                 <div className="relative">
                    <Quote className="absolute -top-4 -left-6 w-8 h-8 text-primary/20 rotate-180" />
                    <p className="text-xl text-muted-foreground leading-relaxed italic z-10 relative">
                        "At EditoHub, we don't just edit videos; we engineer experiences. 
                        In a world of infinite scrolling, we create the moment that makes the world stop and watch. 
                        Our commitment is to premium quality, every single frame."
                    </p>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-4 pt-4">
                     <Button variant="outline">Connect on LinkedIn</Button>
                     <Button variant="ghost">Follow on Twitter</Button>
                 </div>
             </div>
          </motion.div>
      </section>
    </div>
  );
}
