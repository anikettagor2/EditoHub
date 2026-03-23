"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { CheckCircle } from "lucide-react";

function ScrollText() {
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);
        
        const words = textRef.current?.querySelectorAll(".word");
        if (words) {
            gsap.fromTo(words, 
                { opacity: 0.15 },
                {
                    opacity: 1,
                    stagger: 0.08,
                    scrollTrigger: {
                        trigger: textRef.current,
                        start: "top 75%",
                        end: "bottom 30%",
                        scrub: true,
                    }
                }
            );
        }
    }, []);

    const text = "We don't just edit videos. We craft content that hooks viewers in the first 3 seconds, keeps them engaged, and drives them to take action.";

    const features = [
        "Dedicated editor for every project",
        "Unlimited revisions included", 
        "24-48 hour turnaround",
        "Secure file handling"
    ];

    return (
        <section className="bg-[#f6f4ef] py-32 md:py-48 px-6">
            <div className="max-w-5xl mx-auto">
                {/* Main Text */}
                <div ref={textRef} className="mb-20">
                    <p className="text-2xl sm:text-3xl md:text-5xl font-semibold text-zinc-900 leading-snug tracking-tight">
                        {text.split(" ").map((word, i) => (
                            <span key={i} className="word inline-block mr-[0.25em]">{word}</span>
                        ))}
                    </p>
                </div>

                {/* Feature Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {features.map((feature, i) => (
                        <div 
                            key={i} 
                            className="flex items-center gap-3 px-5 py-4 rounded-xl bg-white/80 border border-black/10"
                        >
                            <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                            <span className="text-sm text-zinc-700 font-medium">{feature}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export { ScrollText };
