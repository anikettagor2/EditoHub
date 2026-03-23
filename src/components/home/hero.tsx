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
        <section ref={containerRef} className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#f6f4ef] pt-24 pb-16">
            {/* Background Video */}
            <div className="absolute inset-0 z-0">
                <video 
                    ref={videoRef}
                    autoPlay 
                    muted 
                    loop 
                    playsInline
                    className="w-full h-full object-cover brightness-110 saturate-75"
                >
                    <source src="https://assets.mixkit.co/videos/preview/mixkit-cinematic-night-sky-over-mountains-34241-large.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-linear-to-b from-[#f6f4ef]/75 via-[#f6f4ef]/85 to-[#f6f4ef]" />
            </div>

            <div className="relative z-20 w-full max-w-7xl mx-auto px-6">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    {/* Left Content */}
                    <div className="text-left">
                        {/* Trust Badge */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/85 border border-black/10 mb-8"
                        >
                            <div className="flex -space-x-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                ))}
                            </div>
                            <span className="text-xs text-zinc-700 font-medium">Trusted by 500+ creators</span>
                        </motion.div>

                        {/* Headline */}
                        <motion.h1 
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-zinc-900 leading-[1.1] mb-6"
                        >
                            Professional video editing for 
                            <span className="text-primary"> creators who mean business</span>
                        </motion.h1>

                        {/* Subheadline */}
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="text-lg text-zinc-700 max-w-xl mb-10 leading-relaxed"
                        >
                            From raw footage to publish-ready content. We handle YouTube videos, Instagram Reels, podcasts, and more, with fast turnaround and clear revision cycles.
                        </motion.p>

                        {/* CTAs */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="flex flex-col sm:flex-row gap-4"
                        >
                            <Link href={user ? "/dashboard" : "/signup"}>
                                <button className="group flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/25">
                                    {user ? "Go to Dashboard" : "Start Your Project"}
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </Link>
                            <Link href="/portfolio">
                                <button className="flex items-center justify-center gap-3 px-8 py-4 bg-white/90 border border-black/10 text-zinc-900 font-semibold rounded-xl hover:bg-white transition-all shadow-sm hover:shadow-md">
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
                            className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-black/10 premium-light-surface rounded-2xl px-6 pb-6"
                        >
                            <div>
                                <div className="text-3xl font-bold text-zinc-900">10K+</div>
                                <div className="text-sm text-zinc-600 mt-1">Videos Delivered</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-zinc-900">24hr</div>
                                <div className="text-sm text-zinc-600 mt-1">Avg. Turnaround</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-zinc-900">98%</div>
                                <div className="text-sm text-zinc-600 mt-1">Client Satisfaction</div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Side - Video Preview Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, delay: 0.4 }}
                        className="hidden lg:block relative"
                    >
                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-black/10 bg-white/90 backdrop-blur shadow-2xl">
                            <video 
                                autoPlay 
                                muted 
                                loop 
                                playsInline
                                className="w-full h-full object-cover"
                            >
                                <source src="https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-man-editing-video-43583-large.mp4" type="video/mp4" />
                            </video>
                            <div className="absolute inset-0 bg-linear-to-t from-white/50 via-transparent to-transparent" />
                            
                            {/* Floating Badge */}
                            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                                <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/80 backdrop-blur-md border border-black/10">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-xs text-zinc-800 font-medium">Editors Online Now</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Decorative Elements */}
                        <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/15 rounded-full blur-2xl" />
                        <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-amber-300/20 rounded-full blur-2xl" />
                    </motion.div>
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
