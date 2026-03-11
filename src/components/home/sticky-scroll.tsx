"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";

const PROCESS_STEPS = [
    {
        step: "01",
        title: "Upload Your Footage",
        description: "Simply upload your raw footage through our secure platform. We accept all major formats and provide 256-bit encryption for your content.",
        image: "https://images.unsplash.com/photo-1542204172-3c1f81d05d70?q=80&w=2000"
    },
    {
        step: "02",
        title: "Collaborate in Real-Time",
        description: "Get matched with a dedicated editor who understands your style. Communicate directly, leave timestamped feedback, and request unlimited revisions.",
        image: "https://images.unsplash.com/photo-1621609764095-b32bbe35cf3a?q=80&w=2000"
    },
    {
        step: "03",
        title: "Download & Publish",
        description: "Receive your polished video in 24-48 hours. Download in any format, get platform-optimized exports, and start growing your audience immediately.",
        image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=2000"
    }
];

export function StickyScroll() {
    const sectionRef = useRef<HTMLDivElement>(null);
    const pinRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);

        const ctx = gsap.context(() => {
            const items = gsap.utils.toArray<HTMLElement>(".sticky-content-item");
            const images = gsap.utils.toArray<HTMLElement>(".sticky-image-item");

            // Pin the right side media box
            ScrollTrigger.create({
                trigger: sectionRef.current,
                start: "top top",
                end: "bottom bottom",
                pin: pinRef.current,
                pinSpacing: false,
            });

            // Handle image transitions and text active states
            items.forEach((item, i) => {
                const img = images[i];
                
                ScrollTrigger.create({
                    trigger: item,
                    start: "top 40%",
                    end: "bottom 40%",
                    onToggle: (self) => {
                        if (self.isActive) {
                            // Active Image
                            gsap.to(img, { 
                                opacity: 1, 
                                scale: 1,
                                zIndex: 10,
                                duration: 0.6, 
                                ease: "power2.out",
                                overwrite: "auto"
                            });
                            // Active Text Highlight
                            gsap.to(item, { opacity: 1, x: 20, duration: 0.4 });
                        } else {
                            // Inactive Image
                            gsap.to(img, { 
                                opacity: 0, 
                                scale: 1.05,
                                zIndex: 0,
                                duration: 0.6, 
                                ease: "power2.out",
                                overwrite: "auto"
                            });
                            // Inactive Text
                            gsap.to(item, { opacity: 0.3, x: 0, duration: 0.4 });
                        }
                    }
                });
            });

            // Initial state for non-first items
            gsap.set(items.slice(1), { opacity: 0.3 });
            gsap.set(images.slice(1), { opacity: 0, scale: 1.05 });
        }, sectionRef);

        return () => ctx.revert();
    }, []);

    return (
        <section ref={sectionRef} className="relative bg-black py-32 px-6 overflow-hidden">
            {/* Section Header */}
            <div className="max-w-7xl mx-auto mb-20">
                <span className="text-primary text-sm font-semibold uppercase tracking-wider mb-4 block">How It Works</span>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                    Three simple steps to
                    <span className="text-zinc-500"> professional videos</span>
                </h2>
                <p className="text-lg text-zinc-400 max-w-2xl">
                    No complicated software. No lengthy contracts. Just upload, collaborate, and download.
                </p>
            </div>

            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start gap-12 lg:gap-20">
                
                {/* Left Side: Scrolling Content */}
                <div className="w-full md:w-1/2 space-y-[35vh] py-[15vh]">
                    {PROCESS_STEPS.map((item, i) => (
                        <div key={i} className="sticky-content-item transition-all duration-500">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-5xl font-bold text-primary/20">{item.step}</span>
                            </div>
                            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                {item.title}
                            </h3>
                            <p className="text-zinc-400 text-lg max-w-lg leading-relaxed">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Right Side: Pinned Media Container */}
                <div className="hidden md:block w-1/2 h-screen">
                    <div ref={pinRef} className="relative w-full aspect-[4/3] max-h-[60vh] rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                        <div className="absolute inset-0 z-20 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                        
                        {PROCESS_STEPS.map((item, i) => (
                            <div key={i} className="sticky-image-item absolute inset-0 w-full h-full">
                                <Image 
                                    src={item.image} 
                                    alt={item.title} 
                                    fill 
                                    priority={i === 0}
                                    className="object-cover"
                                />
                            </div>
                        ))}

                        {/* Step indicator */}
                        <div className="absolute bottom-6 left-6 z-30 flex gap-2">
                            {PROCESS_STEPS.map((_, i) => (
                                <div key={i} className="w-8 h-1 rounded-full bg-white/20" />
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
}
