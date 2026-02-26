"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/config";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";  
import { 
    Loader2, 
    Clapperboard, 
    MonitorPlay, 
    Smartphone, 
    Palette, 
    Megaphone, 
    UploadCloud, 
    X, 
    FileVideo, 
    IndianRupee,
    ChevronRight,
    Zap,
    ShieldCheck,
    Globe,
    Terminal,
    Cpu,
    Database,
    Monitor,
    Layers,
    Activity,
    CheckCircle2,
    Info,
    RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const VIDEO_TYPES = [
    { id: "Short Videos", label: "Short Video", icon: Clapperboard, price: 500, desc: "Reels, TikToks, Shorts" },
    { id: "Long Videos", label: "Long Form", icon: MonitorPlay, price: 1000, desc: "YouTube, Explainers" },
    { id: "Reels", label: "Reels Pro", icon: Smartphone, price: 500, desc: "High-end Content" },
    { id: "Graphics Videos", label: "Motion GFX", icon: Palette, price: 1500, desc: "Animations, Intros" },
    { id: "Ads/UGC Videos", label: "Performance", icon: Megaphone, price: 2000, desc: "Ads & UGC" }
];

import { handleProjectCreated } from "@/app/actions/admin-actions";

export default function NewProjectPage() {
    const router = useRouter();
    const { user } = useAuth();
    
    // Form State
    const [name, setName] = useState("");
    const [brand, setBrand] = useState("");
    const [description, setDescription] = useState("");
    const [videoType, setVideoType] = useState("Short Videos");
    const [footageLink, setFootageLink] = useState("");
    const [deadline, setDeadline] = useState("");
    const [rawFiles, setRawFiles] = useState<File[]>([]);
    const [scriptFiles, setScriptFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Derived Logic
    const selectedType = VIDEO_TYPES.find(t => t.id === videoType) || VIDEO_TYPES[0];
    const estimatedCost = (user?.customRates && user.customRates[selectedType.id]) 
        ? user.customRates[selectedType.id] 
        : selectedType.price;

    const handleSubmitProject = async (isPaid: boolean) => {
        if (!user) return;
        setIsSubmitting(true);

        try {
            // 1. Upload All Files
            const uploadedRawFiles: any[] = [];
            const uploadedScripts: any[] = [];

            const uploadFile = async (file: File, path: string) => {
                const storageRef = ref(storage, `${path}/${user.uid}/${Date.now()}_${file.name}`);
                const uploadTask = uploadBytesResumable(storageRef, file);

                return new Promise<any>((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
                        }, 
                        (error) => reject(error), 
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve({
                                name: file.name,
                                url: downloadURL,
                                size: file.size,
                                type: file.type,
                                uploadedAt: Date.now()
                            });
                        }
                    );
                });
            };

            for (const file of rawFiles) {
                uploadedRawFiles.push(await uploadFile(file, 'raw_footage'));
            }

            for (const file of scriptFiles) {
                uploadedScripts.push(await uploadFile(file, 'scripts'));
            }

            // 2. Create Project
            const projectData = {
                name,
                brand,
                description,
                videoType,
                duration: 0, 
                budget: estimatedCost,
                totalCost: estimatedCost,
                amountPaid: isPaid ? estimatedCost : 0, 
                paymentStatus: isPaid ? 'paid' : 'pay_later',
                deadline: deadline || null,
                footageLink, 
                rawFiles: uploadedRawFiles,
                scripts: uploadedScripts,
                assignedPMId: user.managedByPM || null,
                assignedSEId: user.managedBy || user.createdBy || null,
                status: 'pending_assignment', 
                createdAt: Date.now(),
                updatedAt: Date.now(),
                members: [user.uid],
                ownerId: user.uid,
                clientId: user.uid,
                isPayLaterRequest: !isPaid,
                clientName: user.displayName || 'Anonymous Client'
            };

            const projectRef = await addDoc(collection(db, "projects"), projectData);
            
            // 3. Trigger Server-side workflows (Auto PM assignment, WhatsApp, etc)
            await handleProjectCreated(projectRef.id);

            toast.success("Project created successfully!");
            router.push("/dashboard");

        } catch (error: any) {
            console.error("Error creating project:", error);
            toast.error("Something went wrong: " + error.message);
            setIsSubmitting(false);
        }
    };

    const handleFakePayment = () => {
        toast.info("Mock payment gateway invoked. Authorized.");
        handleSubmitProject(true);
    };

    return (
        <div className="max-w-[1400px] mx-auto min-h-[calc(100vh-8rem)] flex flex-col gap-8 pb-10">
            {/* Header Layer */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0 pb-4 border-b border-white/10">
                 <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-1.5"
                >
                    <div className="flex items-center gap-2 mb-1.5">
                        <div className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Step 1</span>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                             <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                             <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Project Details</span>
                        </div>
                    </div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight text-white leading-tight">Start <span className="text-zinc-500">New Project</span></h1>
                    <div className="flex items-center gap-6 pt-1">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Terminal className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Project Setup</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Globe className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">Priority: High</span>
                        </div>
                    </div>
                </motion.div>

                <div className="hidden lg:flex items-center gap-6 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-none">System Status</span>
                        <span className="text-sm font-bold text-emerald-500 mt-1.5 leading-none">Optimized</span>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-none">Editor Availability</span>
                        <span className="text-sm font-bold text-white mt-1.5 leading-none">100% Online</span>
                    </div>
                </div>
            </div>

            {/* Application Main Layout */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Information Ingestion (Left) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    
                    <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="enterprise-card bg-[#161920]/40 backdrop-blur-sm p-6 space-y-6"
                    >
                        <div className="flex items-center gap-2.5 border-b border-white/5 pb-4">
                            <div className="p-1.5 rounded bg-primary/20 border border-primary/30">
                                <Zap className="h-4 w-4 text-primary" />
                            </div>
                            <h3 className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">Project Info</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Project Name</Label>
                                <Input 
                                    placeholder="e.g. Genesis V1 Campaign" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="h-11 bg-white/[0.02] border-white/10 focus:border-primary/50 focus:bg-white/[0.04] transition-all rounded-lg font-medium text-white placeholder:text-zinc-700 text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Client / Brand</Label>
                                <Input 
                                    placeholder="e.g. Nike Global" 
                                    value={brand}
                                    onChange={e => setBrand(e.target.value)}
                                    className="h-11 bg-white/[0.02] border-white/10 focus:border-primary/50 focus:bg-white/[0.04] transition-all rounded-lg font-medium text-white placeholder:text-zinc-700 text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Target Deadline</Label>
                                <Input 
                                    type="date"
                                    value={deadline}
                                    onChange={e => setDeadline(e.target.value)}
                                    className="h-11 bg-white/[0.02] border-white/10 focus:border-primary/50 focus:bg-white/[0.04] transition-all rounded-lg font-medium text-white placeholder:text-zinc-700 text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Instructions</Label>
                            <Textarea 
                                placeholder="Describe the video you want us to create. Include any specific style, music, or pacing preferences..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="min-h-[120px] resize-none bg-white/[0.02] border-white/10 focus:border-primary/50 focus:bg-white/[0.04] transition-all rounded-lg font-medium text-white placeholder:text-zinc-700 text-sm leading-relaxed"
                            />
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="enterprise-card bg-[#161920]/40 backdrop-blur-sm p-6"
                    >
                         <div className="flex items-center gap-2.5 border-b border-white/5 pb-4 mb-6">
                            <div className="p-1.5 rounded bg-primary/20 border border-primary/30">
                                <MonitorPlay className="h-4 w-4 text-primary" />
                            </div>
                            <h3 className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">Video Type Selection</h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                             {VIDEO_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isSelected = videoType === type.id;
                                if (user?.allowedFormats && user.allowedFormats[type.id] === false) return null;
                                const finalPrice = (user?.customRates && user.customRates[type.id]) ? user.customRates[type.id] : type.price;

                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setVideoType(type.id)}
                                        className={cn(
                                            "group flex flex-col items-center gap-3 p-4 rounded-xl border transition-all relative overflow-hidden",
                                            isSelected 
                                                ? "bg-primary border-primary shadow-[0_0_20px_rgba(var(--primary),0.2)]" 
                                                : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                                            isSelected ? "bg-white text-black" : "bg-white/5 text-zinc-500 group-hover:text-primary"
                                        )}>
                                            <Icon className="h-4.5 w-4.5" />
                                        </div>
                                        
                                        <div className="text-center space-y-1">
                                            <div className={cn("text-[10px] font-bold uppercase tracking-widest leading-none", isSelected ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")}>
                                                {type.label}
                                            </div>
                                            <div className={cn("font-bold text-[9px] tabular-nums leading-none", isSelected ? "text-white/70" : "text-zinc-700")}>
                                                ₹{finalPrice}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>

                {/* Asset Ingestion & Commitment (Right) */}
                <div className="lg:col-span-4 flex flex-col gap-6 relative">
                    <div className="lg:sticky lg:top-6 flex flex-col gap-6">
                    
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="enterprise-card bg-[#161920]/40 backdrop-blur-sm p-6 flex flex-col min-h-[280px]"
                    >
                         <div className="flex items-center gap-2.5 border-b border-white/5 pb-4 mb-6">
                            <div className="p-1.5 rounded bg-primary/20 border border-primary/30">
                                <UploadCloud className="h-4 w-4 text-primary" />
                            </div>
                            <h3 className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">Upload Files</h3>
                        </div>
                         
                         <div className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[9px] font-bold uppercase text-zinc-600 tracking-widest ml-1">Raw Footage</Label>
                                <div className="border border-dashed border-white/10 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] hover:border-primary/50 transition-all relative group p-4 min-h-[100px] flex flex-col items-center justify-center text-center cursor-pointer">
                                    <input 
                                        type="file" 
                                        multiple
                                        accept="video/*,image/*,.zip,.rar"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={(e) => {
                                            if (e.target.files) setRawFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                        }}
                                    />
                                    <div className="space-y-1">
                                        <div className="w-8 h-8 bg-white/[0.03] text-zinc-700 rounded-lg flex items-center justify-center mx-auto group-hover:scale-105 group-hover:text-primary transition-all">
                                            <UploadCloud className="w-4 h-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-zinc-500">Upload Video Files</p>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                    {rawFiles.map((file, i) => (
                                        <div key={i} className="flex flex-col p-3 bg-white/[0.02] border border-white/5 rounded-lg gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                                        <FileVideo className="h-3 w-3 text-primary" />
                                                    </div>
                                                    <span className="text-[10px] font-medium text-zinc-300 truncate">{file.name}</span>
                                                </div>
                                                <button disabled={isSubmitting} onClick={() => setRawFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                            {uploadProgress[file.name] !== undefined && (
                                                <div className="space-y-1.5 mt-1">
                                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-300">
                                                        <span>{Math.round(uploadProgress[file.name])}% UPLOADED</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-primary transition-all duration-300 ease-out" 
                                                            style={{ width: `${uploadProgress[file.name]}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[9px] font-bold uppercase text-zinc-600 tracking-widest ml-1">Scripts & Docs</Label>
                                <div className="border border-dashed border-white/10 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] hover:border-primary/50 transition-all relative group p-4 min-h-[100px] flex flex-col items-center justify-center text-center cursor-pointer">
                                    <input 
                                        type="file" 
                                        multiple
                                        accept=".pdf,.doc,.docx,.txt,.rtf"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={(e) => {
                                            if (e.target.files) setScriptFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                        }}
                                    />
                                    <div className="space-y-1">
                                        <div className="w-8 h-8 bg-white/[0.03] text-zinc-700 rounded-lg flex items-center justify-center mx-auto group-hover:scale-105 group-hover:text-primary transition-all">
                                            <UploadCloud className="w-4 h-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-zinc-500">Upload Scripts</p>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                    {scriptFiles.map((file, i) => (
                                        <div key={i} className="flex flex-col p-3 bg-white/[0.02] border border-white/5 rounded-lg gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                                                        <Monitor className="h-3 w-3 text-blue-500" />
                                                    </div>
                                                    <span className="text-[10px] font-medium text-zinc-300 truncate">{file.name}</span>
                                                </div>
                                                <button disabled={isSubmitting} onClick={() => setScriptFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                            {uploadProgress[file.name] !== undefined && (
                                                <div className="space-y-1.5 mt-1">
                                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-300">
                                                        <span>{Math.round(uploadProgress[file.name])}% UPLOADED</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-500 transition-all duration-300 ease-out" 
                                                            style={{ width: `${uploadProgress[file.name]}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                         </div>

                         <div className="mt-6 space-y-2">
                             <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 ml-1">External Data Port (URL)</Label>
                             <Input 
                                placeholder="G-Drive, Dropbox, WeTransfer link..." 
                                value={footageLink}
                                onChange={e => setFootageLink(e.target.value)}
                                className="h-9 text-[11px] bg-white/[0.01] border-white/10 rounded-lg pl-3 focus:border-primary/50 focus:bg-white/[0.03] transition-all"
                            />
                         </div>
                    </motion.div>

                    <motion.div 
                         initial={{ opacity: 0, scale: 0.98 }}
                         animate={{ opacity: 1, scale: 1 }}
                         transition={{ delay: 0.4 }}
                         className="enterprise-card bg-[#161920]/40 backdrop-blur-sm p-6 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-[40px] rounded-full pointer-events-none" />

                        <div className="flex justify-between items-center mb-8">
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Project Price</div>
                                <div className="text-3xl font-black text-white tracking-tighter tabular-nums font-heading">₹{estimatedCost.toLocaleString()}</div>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Advance Payment</div>
                                <div className="text-xl font-black text-primary tracking-tight tabular-nums">₹{Math.round(estimatedCost * 0.5).toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleFakePayment}
                                disabled={isSubmitting || !name || !description}
                                className="w-full h-12 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-widest rounded-lg shadow-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                                {isSubmitting ? "PROCESSING..." : `PAY ₹${estimatedCost} NOW`}
                            </button>

                            {user?.payLater && (
                                <button 
                                    onClick={() => handleSubmitProject(false)}
                                    disabled={isSubmitting || !name || !description}
                                    className="w-full bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] h-12 rounded-lg text-zinc-300 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-20 disabled:pointer-events-none"
                                >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    USE DEFERRED PAYMENT (PAY LATER)
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-6 justify-center">
                            <ShieldCheck className="h-3 w-3 text-zinc-700" />
                            <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">
                                Standard Secure Setup Active
                            </p>
                        </div>
                    </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
