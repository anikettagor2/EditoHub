"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/config";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";  
import { Loader2, Clapperboard, MonitorPlay, Smartphone, Palette, Megaphone, UploadCloud, X, FileVideo, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VIDEO_TYPES = [
    { id: "Short Videos", label: "Short Video", icon: Clapperboard, price: 500, desc: "Reels, TikToks, Shorts" },
    { id: "Long Videos", label: "Long Form", icon: MonitorPlay, price: 1000, desc: "YouTube, Explainers" },
    { id: "Reels", label: "Reels Pro", icon: Smartphone, price: 500, desc: "High-end Social Content" },
    { id: "Graphics Videos", label: "Motion gfx", icon: Palette, price: 1500, desc: "Animations, Intros" },
    { id: "Ads/UGC Videos", label: "Ads / UGC", icon: Megaphone, price: 2000, desc: "Performance Marketing" }
];

// Helper for loading script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function NewProjectPage() {
    const router = useRouter();
    const { user } = useAuth();
    
    // Form State
    const [name, setName] = useState("");
    const [brand, setBrand] = useState("");
    const [description, setDescription] = useState("");
    const [videoType, setVideoType] = useState("Short Videos");
    const [footageLink, setFootageLink] = useState("");
    const [rawFile, setRawFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Derived Logic
    const selectedType = VIDEO_TYPES.find(t => t.id === videoType) || VIDEO_TYPES[0];
    const estimatedCost = (user?.customRates && user.customRates[selectedType.id]) 
        ? user.customRates[selectedType.id] 
        : selectedType.price;

    const handlePayLater = async () => {
        if (!user) return;
        setIsSubmitting(true);

        try {
            // 1. Upload File (if any)
            let uploadedFileMetadata = null;
            if (rawFile) {
                const storageRef = ref(storage, `raw_footage/${user.uid}/${Date.now()}_${rawFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, rawFile);

                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        }, 
                        (error) => reject(error), 
                        () => resolve()
                    );
                });

                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                uploadedFileMetadata = {
                    name: rawFile.name,
                    url: downloadURL,
                    size: rawFile.size,
                    type: rawFile.type,
                    uploadedAt: Date.now()
                };
            }

            // 2. Create Project with Pay Later Status
            const projectData = {
                name,
                brand,
                description,
                videoType,
                duration: 0, 
                budget: estimatedCost,
                totalCost: estimatedCost,
                amountPaid: 0, 
                paymentStatus: 'pay_later',
                deadline: null, 
                footageLink, 
                rawFiles: uploadedFileMetadata ? [uploadedFileMetadata] : [], 
                status: 'pending_assignment', 
                createdAt: Date.now(),
                updatedAt: Date.now(),
                members: [user.uid],
                ownerId: user.uid,
                clientId: user.uid,
                isPayLaterRequest: true
            };

            const projectRef = await addDoc(collection(db, "projects"), projectData);
            
            // 3. Trigger WhatsApp Notification
            import("@/app/actions/admin-actions").then(actions => {
                actions.handleProjectCreated(projectRef.id);
            });

            toast.success("Project request submitted successfully!");
            toast.info("Our team will review your request and assign an editor shortly.");
            router.push("/dashboard");

        } catch (error: any) {
            console.error("Error creating pay later project:", error);
            toast.error("Failed: " + error.message);
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        // e.preventDefault();
        toast.info("Standard payment is currently unavailable. Please use the 'Pay Later' option.");
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 md:p-6 overflow-hidden flex flex-col gap-6">
            <header className="flex-none">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    New Project Request
                </h1>
                <p className="text-sm text-zinc-400">
                    Define your project requirements and get started.
                </p>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                {/* LEFT: Main Details (Scrollable if needed, but intended to fit) */}
                <div className="lg:col-span-7 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    
                    {/* 1. Project Info Card */}
                    <div className="bg-card/50 border border-border rounded-xl p-5 backdrop-blur-sm">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-4 block">Project Details</Label>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Project Name</Label>
                                <Input 
                                    placeholder="e.g. Summer Launch" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="h-9 bg-background/50 border-white/5 focus:border-primary/50 transition-colors"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Brand Name</Label>
                                <Input 
                                    placeholder="e.g. Nike" 
                                    value={brand}
                                    onChange={e => setBrand(e.target.value)}
                                    className="h-9 bg-background/50 border-white/5 focus:border-primary/50 transition-colors"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Instructions & Vision</Label>
                            <Textarea 
                                placeholder="Describe the editing style, pacing, and specific requirements..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="min-h-[100px] resize-none bg-background/50 border-white/5 focus:border-primary/50 transition-colors text-sm"
                            />
                        </div>
                    </div>

                    {/* 2. Style Selection Card */}
                    <div className="bg-card/50 border border-border rounded-xl p-5 backdrop-blur-sm flex-1">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-4 block">Select Format</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
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
                                            "flex flex-col gap-2 p-3 rounded-lg border text-left transition-all",
                                            isSelected 
                                                ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)]" 
                                                : "bg-background/30 border-white/5 hover:bg-white/5"
                                        )}
                                    >
                                        <div className="flex justify-between items-start w-full">
                                            <Icon className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", 
                                                isSelected ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground"
                                            )}>
                                                ₹{finalPrice}
                                            </span>
                                        </div>
                                        <div>
                                            <div className={cn("font-medium text-xs", isSelected ? "text-foreground" : "text-zinc-400")}>{type.label}</div>
                                            <div className="text-[10px] text-muted-foreground line-clamp-1">{type.desc}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Assets & Actions (Fixed height) */}
                <div className="lg:col-span-5 flex flex-col gap-4 h-full">
                    
                    {/* 3. Upload Area */}
                    <div className="bg-card/50 border border-border rounded-xl p-5 backdrop-blur-sm flex-1 flex flex-col min-h-[200px]">
                         <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-4 block">Assets</Label>
                         
                         <div className="flex-1 border-2 border-dashed border-white/10 rounded-lg bg-background/20 hover:bg-background/40 transition-colors relative group flex flex-col items-center justify-center p-6 text-center">
                            <input 
                                type="file" 
                                accept="video/*,image/*,.zip,.rar"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) setRawFile(e.target.files[0]);
                                }}
                            />
                            
                            {rawFile ? (
                                <div className="space-y-3 z-20 w-full">
                                    <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto">
                                        <FileVideo className="w-6 h-6" />
                                    </div>
                                    <div className="text-sm font-medium pr-6 truncate">{rawFile.name}</div>
                                    <div className="text-xs text-muted-foreground">{(rawFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute top-2 right-2 h-6 w-6 text-zinc-500 hover:text-red-500 z-30"
                                        onClick={(e) => { e.preventDefault(); setRawFile(null); }}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="w-12 h-12 bg-white/5 text-zinc-400 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                        <UploadCloud className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">Drag files here or click</p>
                                        <p className="text-xs text-zinc-500 mt-1">MP4, MOV, ZIP up to 2GB</p>
                                    </div>
                                </div>
                            )}

                             {uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                </div>
                            )}
                         </div>

                         <div className="mt-4">
                             <Label className="text-xs mb-1.5 block">Or paste a link</Label>
                             <Input 
                                placeholder="Google Drive / Dropbox link..." 
                                value={footageLink}
                                onChange={e => setFootageLink(e.target.value)}
                                className="h-8 text-xs bg-background/50 border-white/5"
                            />
                         </div>
                    </div>

                    {/* 4. Checkout summary */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <div className="text-sm font-medium text-zinc-300">Total Estimate</div>
                                <div className="text-2xl font-bold text-white">₹{estimatedCost.toLocaleString()}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-zinc-500">Advance (50%)</div>
                                <div className="text-lg font-bold text-primary">₹{Math.round(estimatedCost * 0.5).toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                             <Button 
                                onClick={handleSubmit}
                                disabled={isSubmitting || !name || !description}
                                variant="outline"
                                className="w-full h-12 border-zinc-800 text-zinc-500 hover:bg-transparent cursor-not-allowed"
                            >
                                < DollarSign className="h-4 w-4 mr-2" />
                                Proceed to Payment (Disabled)
                            </Button>

                            <Button 
                                onClick={handlePayLater}
                                disabled={isSubmitting || !name || !description}
                                className="w-full bg-primary hover:bg-primary/90 h-12 text-md font-semibold shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="animate-spin" /> Submitting...
                                    </span>
                                ) : (
                                    "Pay Later & Request Project"
                                )}
                            </Button>
                        </div>
                        <p className="text-[10px] text-center text-zinc-500 mt-3">
                            Direct request will be reviewed by our team. Payment required after draft approval.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
