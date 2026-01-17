"use client";

import { motion } from "framer-motion";
import { Film, PenTool, Image, Layers, ArrowRight } from "lucide-react";
import Link from "next/link";

const services = [
  {
    title: "Short-form Editing",
    description: "Engaging Reels, TikToks, and Shorts designed to boost retention and virality. We nail the pacing and effects.",
    icon: Film,
  },
  {
    title: "Scriptwriting",
    description: "Compelling narratives and hooks attached to psychology-driven storytelling that keeps your audience watching.",
    icon: PenTool,
  },
  {
    title: "Thumbnail Design",
    description: "High-CTR, curiosity-inducing thumbnails that scream 'Click Me' instantly.",
    icon: Image,
  },
  {
    title: "Bulk Video Editing",
    description: "Scalable editing solutions for podcasters, courses, and content machines handling massive volume.",
    icon: Layers,
  },
];

export function Services() {
  return (
    <section id="services" className="py-32 bg-secondary/20 relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 p-32 bg-purple-500/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-20 space-y-4">
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-bold font-heading"
            >
                Our Expertise
            </motion.h2>
            <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-muted-foreground text-lg max-w-2xl mx-auto"
            >
                Comprehensive creative solutions tailored for modern digital growth.
            </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => (
                <ServiceCard key={index} {...service} index={index} />
            ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ title, description, icon: Icon, index }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="group p-8 rounded-3xl bg-card/50 border border-white/5 hover:border-primary/50 hover:bg-card transition-all duration-500 relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner">
                    <Icon className="w-7 h-7" />
                </div>
                
                <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                    {description}
                </p>

                <div className="flex items-center text-sm font-medium text-primary opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    Learn more <ArrowRight className="w-4 h-4 ml-2" />
                </div>
            </div>
        </motion.div>
    )
}
