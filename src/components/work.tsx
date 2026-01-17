"use client";

import { motion } from "framer-motion";
import { FolderOpen, ArrowUpRight, PlayCircle, Video, Clapperboard, MonitorPlay, Film, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const portfolioItems = [
  {
    title: "Short Form Content",
    category: "Reels & TikToks",
    link: "https://drive.google.com/drive/folders/1DYUBo8RX514BpcysVIlFHAUstlzTnCZ1?usp=drive_link",
    gradient: "from-pink-500 via-red-500 to-yellow-500", // Instagram/TikTok vibe
    icon: Zap,
  },
  {
    title: "Commercial Edits",
    category: "Ads & Promos",
    link: "https://drive.google.com/drive/folders/14nEGKk7ZeIlcFUvaQwmv3uwjXAkEG5tE?usp=drive_link",
    gradient: "from-blue-600 via-indigo-500 to-cyan-400", // Corporate/Trust vibe
    icon: MonitorPlay,
  },
  {
    title: "YouTube Long Form",
    category: "Storytelling & retention",
    link: "https://drive.google.com/drive/folders/1uqzEvsRSVpj3oGZRMDlbBhekkOYJxUqk?usp=drive_link",
    gradient: "from-red-600 to-red-900", // YouTube vibe
    icon: Video,
  },
  {
    title: "Documentary Style",
    category: "Cinematic narratives",
    link: "https://drive.google.com/drive/folders/15YARJwHmVRFwuxeUjz5LvbdF7uWoK-QH?usp=drive_link",
    gradient: "from-stone-700 to-stone-900", // Gritty/Doc vibe
    icon: Film,
  },
  {
    title: "Brand Promos",
    category: "Motion Graphics",
    link: "https://drive.google.com/drive/folders/1kaWHpiP8BcjrH41YiuXhb8Xv6BVgxc0j?usp=drive_link",
    gradient: "from-purple-600 to-indigo-900", // Premium/Creative vibe
    icon: Clapperboard,
  },
];

export function Work() {
  return (
    <section id="work" className="py-32 bg-black relative">
       {/* Decorative Lines */}
       <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
       
       <div className="container mx-auto px-6">
           <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16 space-y-4"
           >
                <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-2">
                    <PlayCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Recent Projects</span>
                </div>
               <h2 className="text-4xl md:text-6xl font-bold font-heading">
                   Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">Masterpieces</span>
               </h2>
               <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                   Explore our curated collections of video edits. Every cut, transition, and effect is crafted to perfection.
               </p>
           </motion.div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {portfolioItems.map((item, index) => (
                   <PortfolioCard key={index} {...item} index={index} />
               ))}
           </div>
       </div>
    </section>
  );
}

function PortfolioCard({ title, category, link, gradient, icon: Icon, index }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="group relative h-full"
        >
            <Link href={link} target="_blank" rel="noopener noreferrer" className="block h-full">
                <div className="relative overflow-hidden rounded-3xl bg-secondary border border-white/5 hover:border-primary/50 transition-all duration-500 h-full flex flex-col group-hover:shadow-[0_0_40px_rgba(99,102,241,0.2)]">
                    
                    {/* Visual Cover Section (Placeholder for Image) */}
                    <div className={`relative w-full aspect-[16/10] bg-gradient-to-br ${gradient} p-6 flex items-center justify-center overflow-hidden`}>
                         <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500" />
                         
                         {/* Animated Icon Background */}
                         <Icon className="absolute text-white/10 w-40 h-40 -bottom-10 -right-10 rotate-12 group-hover:rotate-0 group-hover:scale-110 transition-transform duration-700 ease-out" />
                         
                         {/* Central Icon */}
                         <div className="relative z-10 w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-transform duration-500">
                             <Icon className="w-10 h-10 text-white" />
                         </div>

                         {/* Overlay Text "Preview" */}
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <span className="text-white font-medium tracking-wide bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/20">
                                View Folder
                              </span>
                         </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 flex flex-col flex-grow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold font-heading mb-1 group-hover:text-primary transition-colors">{title}</h3>
                                <p className="text-muted-foreground text-sm font-medium">{category}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                <ArrowUpRight className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                </div>
            </Link>
        </motion.div>
    );
}
