"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Link from "next/link";
import { Play, ArrowRight, Star } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";

export function Hero() {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const { user } = useAuth();

    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);
        
        gsap.to(videoRef.current, {
            scale: 1.1,
            opacity: 0.2,
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top top",
                end: "bottom top",
                scrub: true
            }
        });
    }, []);

    return (
        <section ref={containerRef} className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0F1115] pt-24 pb-16">
            {/* Background Video */}
            <div className="absolute inset-0 z-0">
                <video 
                    ref={videoRef}
                    autoPlay 
                    muted 
                    loop 
                    playsInline
                    className="w-full h-full object-cover brightness-50 saturate-50"
                >
                    <source src="https://assets.mixkit.co/videos/preview/mixkit-cinematic-night-sky-over-mountains-34241-large.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-linear-to-b from-[#0F1115]/70 via-[#0F1115]/85 to-[#0F1115]" />
            </div>

            <div className="relative z-20 w-full max-w-5xl mx-auto px-6">
                <div className="flex flex-col items-center justify-center">
                    {/* Left Content */}
                    <div className="text-center flex flex-col items-center">
                        {/* Trust Badge */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md"
                        >
                            <div className="flex -space-x-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                ))}
                            </div>
                            <span className="text-xs text-zinc-300 font-medium">Trusted by 500+ creators</span>
                        </motion.div>

                        {/* Headline */}
                        <motion.h1 
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] mb-6"
                        >
                            Professional video editing for 
                            <span className="text-primary block mt-2"> creators who mean business</span>
                        </motion.h1>

                        {/* Subheadline */}
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="text-lg text-zinc-400 max-w-2xl mb-10 leading-relaxed"
                        >
                            From raw footage to publish-ready content. We handle YouTube videos, Instagram Reels, podcasts, and more, with fast turnaround and clear revision cycles.
                        </motion.p>

                        {/* CTAs */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="flex flex-col sm:flex-row gap-4 items-center justify-center"
                        >
                            <Link href={user ? "/dashboard" : "/signup"}>
                                <button className="group flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/25">
                                    {user ? "Go to Dashboard" : "Start Your Project"}
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </Link>
                            <Link href="/portfolio">
                                <button className="flex items-center justify-center gap-3 px-8 py-4 bg-white/10 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all shadow-sm hover:shadow-md backdrop-blur-md">
                                    <Play className="w-4 h-4" />
                                    View Our Work
                                </button>
                            </Link>
                        </motion.div>

                        {/* Stats */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.5 }}
                            className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-white/10 premium-dark-surface rounded-2xl px-6 pb-6 w-full max-w-3xl"
                        >
                            <div>
                                <div className="text-3xl font-bold text-white">10K+</div>
                                <div className="text-sm text-zinc-400 mt-1">Videos Delivered</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">24hr</div>
                                <div className="text-sm text-zinc-400 mt-1">Avg. Turnaround</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">98%</div>
                                <div className="text-sm text-zinc-400 mt-1">Client Satisfaction</div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Scroll Indicator */}
            <motion.div 
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            >
                <span className="text-xs text-zinc-600 uppercase tracking-widest">Scroll</span>
                <div className="w-px h-8 bg-linear-to-b from-zinc-500/30 to-transparent" />
            </motion.div>
        </section>
    );
}
