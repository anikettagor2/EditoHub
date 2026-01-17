"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Zap, Trophy, Users, Star } from "lucide-react";

const features = [
  {
    title: "Cinematic Quality",
    description: "Every frame polished to perfection with top-tier color grading and sound design.",
    icon: Trophy,
  },
  {
    title: "Lightning Fast Delivery",
    description: "48-hour turnaround for most projects so you never miss a post schedule.",
    icon: Zap,
  },
  {
    title: "Retention-Focused",
    description: "Edits engineered to hook viewers in the first 3 seconds and hold them.",
    icon: Users,
  },
  {
    title: "Unlimited Revisions",
    description: "We refine the work until it meets your exact vision, guaranteed.",
    icon: CheckCircle2,
  }
];

export function WhyChooseUs() {
  return (
    <section className="py-32 bg-black relative">
       {/* Background Glow */}
       <div className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

       <div className="container mx-auto px-6">
           <div className="flex flex-col lg:flex-row gap-16 items-center">
               <div className="w-full lg:w-1/2 space-y-8">
                   <motion.div
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                   >
                       <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-medium text-yellow-500">Industry Leader</span>
                       </div>
                       <h2 className="text-4xl md:text-6xl font-bold font-heading leading-tight">
                          Why Top Creators <br />
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">Choose EditoHub</span>
                       </h2>
                   </motion.div>

                   <motion.p
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 }}
                      className="text-xl text-muted-foreground leading-relaxed"
                   >
                      We don't just edit videos; we engineer growth. Our team understands the algorithm, psychology, and art of digital storytelling.
                   </motion.p>

                   {/* Stats */}
                   <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 }}
                        className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10"
                   >
                       <div>
                           <h4 className="text-3xl font-bold text-white">500+</h4>
                           <p className="text-sm text-muted-foreground">Videos Edited</p>
                       </div>
                       <div>
                           <h4 className="text-3xl font-bold text-white">100M+</h4>
                           <p className="text-sm text-muted-foreground">Views Generated</p>
                       </div>
                       <div>
                           <h4 className="text-3xl font-bold text-white">50+</h4>
                           <p className="text-sm text-muted-foreground">Happy Clients</p>
                       </div>
                   </motion.div>
               </div>
               
               <div className="w-full lg:w-1/2">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       {features.map((feature, i) => (
                           <FeatureCard key={i} {...feature} delay={i * 0.15} />
                       ))}
                   </div>
               </div>
           </div>
       </div>
    </section>
  )
}

function FeatureCard({ title, description, icon: Icon, delay }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.5 }}
            whileHover={{ y: -5 }}
            className="p-8 rounded-3xl bg-secondary/30 border border-white/5 hover:bg-secondary hover:border-primary/20 transition-all duration-300"
        >
             <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-primary">
                <Icon className="w-6 h-6" />
             </div>
             <h3 className="text-lg font-bold mb-3 text-white">{title}</h3>
             <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        </motion.div>
    )
}
