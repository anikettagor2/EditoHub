"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/config";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";  
import { 
    Loader2, 
    UploadCloud, 
    X, 
    FileVideo, 
    IndianRupee,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    Zap,
    Clock,
    Link as LinkIcon,
    FileText,
    Image as ImageIcon,
    CreditCard,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

import { handleProjectCreated } from "@/app/actions/admin-actions";

interface UploadedFile {
    name: string;
    url: string;
    size: number;
    type: string;
    uploadedAt: number;
}

interface FileWithProgress {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'complete' | 'error';
    uploadedData?: UploadedFile;
    error?: string;
}

const VIDEO_TYPES = [
    { key: "Reel Format", label: "Reel Format", desc: "Optimized for vertical consumption" },
    { key: "Long Video", label: "Long Video", desc: "Standard horizontal long-form content" },
    { key: "Documentary", label: "Documentary", desc: "Story-telling and cinematic archives" },
    { key: "Podcast Edit", label: "Podcast Edit", desc: "Multi-cam or single stream podcasting" },
    { key: "Motion Graphic", label: "Motion Graphic", desc: "Animated vectors and clean graphics" },
    { key: "Cinematic Event", label: "Cinematic Event", desc: "High production value event coverage" }
];

const ASPECT_RATIOS = [
    { key: "9:16", label: "9:16", desc: "Reels / Shorts" },
    { key: "1:1", label: "1:1", desc: "Instagram Post" },
    { key: "16:9", label: "16:9", desc: "YouTube Standard" }
];

const DEFAULT_URGENT_PRICE = 500;
const BASE_PROJECT_PRICE = 1000;
const MAX_CONCURRENT_UPLOADS = 3; // Upload up to 3 files simultaneously

export default function NewProjectPage() {
    const router = useRouter();
    const { user } = useAuth();
    
    // Step State
    const [currentStep, setCurrentStep] = useState(1);

    // Step 1: Project Information
    const [name, setName] = useState("");
    const [videoType, setVideoType] = useState<string>("Reel Format");
    const [aspectRatio, setAspectRatio] = useState<string>("9:16");
    const [urgency, setUrgency] = useState<'24hrs' | 'urgent'>('24hrs');
    const [description, setDescription] = useState("");

    // Step 3: Files with immediate upload tracking
    const [rawFiles, setRawFiles] = useState<FileWithProgress[]>([]);
    const [scriptFiles, setScriptFiles] = useState<FileWithProgress[]>([]);
    const [referenceFiles, setReferenceFiles] = useState<FileWithProgress[]>([]);
    const [scriptText, setScriptText] = useState("");
    const [footageLink, setFootageLink] = useState("");
    const [referenceLink, setReferenceLink] = useState("");
    
    // Misc
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Derived Logic
    const wordCount = description.trim() === "" ? 0 : description.trim().split(/\s+/).length;
    
    // Dynamic pricing calculation
    const basePrice = user?.customRates?.[videoType] || BASE_PROJECT_PRICE;
    const urgentExtraCost = urgency === 'urgent' ? DEFAULT_URGENT_PRICE : 0;
    const finalCost = basePrice + urgentExtraCost;

    const canPayLater = user?.payLater === true;

    // Check if all files are uploaded
    const allFilesUploaded = [...rawFiles, ...scriptFiles, ...referenceFiles].every(
        f => f.status === 'complete'
    );
    const hasUploadingFiles = [...rawFiles, ...scriptFiles, ...referenceFiles].some(
        f => f.status === 'uploading'
    );
    const totalUploadProgress = (() => {
        const allFiles = [...rawFiles, ...scriptFiles, ...referenceFiles];
        if (allFiles.length === 0) return 100;
        const total = allFiles.reduce((acc, f) => acc + f.progress, 0);
        return Math.round(total / allFiles.length);
    })();

    // Immediate file upload function
    const uploadFileImmediately = useCallback(async (
        file: File, 
        path: string,
        onProgress: (progress: number) => void,
        onComplete: (data: UploadedFile) => void,
        onError: (error: string) => void
    ) => {
        if (!user) return;

        try {
            const storageRef = ref(storage, `${path}/${user.uid}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    onProgress(progress);
                }, 
                (error) => {
                    console.error('Upload error:', error);
                    onError(error.message || 'Upload failed');
                }, 
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        onComplete({
                            name: file.name,
                            url: downloadURL,
                            size: file.size,
                            type: file.type,
                            uploadedAt: Date.now()
                        });
                    } catch (err: any) {
                        onError(err.message || 'Failed to get download URL');
                    }
                }
            );
        } catch (error: any) {
            onError(error.message || 'Upload failed');
        }
    }, [user]);

    // Handle file selection and immediate upload
    const handleFileUpload = useCallback((
        e: React.ChangeEvent<HTMLInputElement>, 
        type: 'raw' | 'script' | 'reference'
    ) => {
        if (!e.target.files || !user) return;
        
        const files = Array.from(e.target.files);
        const path = type === 'raw' ? 'raw_footage' : type === 'script' ? 'scripts' : 'references';
        
        const newFileEntries: FileWithProgress[] = files.map(file => ({
            file,
            progress: 0,
            status: 'pending' as const
        }));

        // Add files to state
        if (type === 'raw') {
            setRawFiles(prev => [...prev, ...newFileEntries]);
        } else if (type === 'script') {
            setScriptFiles(prev => [...prev, ...newFileEntries]);
        } else {
            setReferenceFiles(prev => [...prev, ...newFileEntries]);
        }

        // Start uploading each file
        files.forEach((file, index) => {
            const setState = type === 'raw' ? setRawFiles : type === 'script' ? setScriptFiles : setReferenceFiles;
            
            // Find the index in the new combined array
            setTimeout(() => {
                setState(prev => {
                    const fileIndex = prev.findIndex(f => f.file === file && f.status === 'pending');
                    if (fileIndex === -1) return prev;
                    
                    const updated = [...prev];
                    updated[fileIndex] = { ...updated[fileIndex], status: 'uploading' };
                    return updated;
                });

                uploadFileImmediately(
                    file,
                    path,
                    (progress) => {
                        setState(prev => {
                            const fileIndex = prev.findIndex(f => f.file === file);
                            if (fileIndex === -1) return prev;
                            const updated = [...prev];
                            updated[fileIndex] = { ...updated[fileIndex], progress };
                            return updated;
                        });
                    },
                    (uploadedData) => {
                        setState(prev => {
                            const fileIndex = prev.findIndex(f => f.file === file);
                            if (fileIndex === -1) return prev;
                            const updated = [...prev];
                            updated[fileIndex] = { 
                                ...updated[fileIndex], 
                                status: 'complete', 
                                progress: 100,
                                uploadedData 
                            };
                            return updated;
                        });
                    },
                    (error) => {
                        setState(prev => {
                            const fileIndex = prev.findIndex(f => f.file === file);
                            if (fileIndex === -1) return prev;
                            const updated = [...prev];
                            updated[fileIndex] = { 
                                ...updated[fileIndex], 
                                status: 'error', 
                                error 
                            };
                            return updated;
                        });
                        toast.error(`Failed to upload ${file.name}`);
                    }
                );
            }, index * 200); // Stagger uploads slightly
        });

        // Reset input
        e.target.value = '';
    }, [user, uploadFileImmediately]);

    const removeFile = (index: number, type: 'raw' | 'script' | 'reference') => {
        if (type === 'raw') {
            setRawFiles(prev => prev.filter((_, i) => i !== index));
        } else if (type === 'script') {
            setScriptFiles(prev => prev.filter((_, i) => i !== index));
        } else {
            setReferenceFiles(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleNextStep = () => {
        if (currentStep === 1) {
            if (!name) return toast.error("Project name is required.");
            if (wordCount > 100) return toast.error("Description cannot exceed 100 words.");
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(3);
        } else if (currentStep === 3) {
            if (rawFiles.length === 0 && !footageLink) {
                return toast.error("Please provide either raw files or a Google Drive link.");
            }
            if (hasUploadingFiles) {
                return toast.error("Please wait for all files to finish uploading.");
            }
            const failedFiles = [...rawFiles, ...scriptFiles, ...referenceFiles].filter(f => f.status === 'error');
            if (failedFiles.length > 0) {
                return toast.error(`${failedFiles.length} file(s) failed to upload. Please remove and re-upload them.`);
            }
            setCurrentStep(4);
        }
    };

    const handlePrevStep = () => {
        setCurrentStep(prev => Math.max(1, prev - 1));
    };

    const handleSubmitProject = async (paymentOption: 'pay_now' | 'pay_later') => {
        if (!user) return;
        setIsSubmitting(true);

        try {
            // Files are already uploaded - just collect the data
            const uploadedRawFiles = rawFiles
                .filter(f => f.status === 'complete' && f.uploadedData)
                .map(f => f.uploadedData!);
            
            const uploadedScripts = scriptFiles
                .filter(f => f.status === 'complete' && f.uploadedData)
                .map(f => f.uploadedData!);
            
            const uploadedReferences = referenceFiles
                .filter(f => f.status === 'complete' && f.uploadedData)
                .map(f => f.uploadedData!);

            // Create Project
            const projectData = {
                name,
                videoType,
                description,
                urgency,
                budget: finalCost,
                totalCost: finalCost,
                amountPaid: paymentOption === 'pay_now' ? finalCost : 0, 
                paymentStatus: paymentOption === 'pay_now' ? 'paid' : 'pay_later',
                paymentOption, // either pay_now or pay_later
                deadline: null, // As requested
                footageLink, 
                rawFiles: uploadedRawFiles,
                scripts: uploadedScripts,
                referenceFiles: uploadedReferences,
                referenceLink,
                aspectRatio,
                videoFormat: videoType,
                scriptText,
                assignedPMId: user.managedByPM || null,
                assignedSEId: user.managedBy || user.createdBy || null,
                status: 'pending_assignment', 
                createdAt: Date.now(),
                updatedAt: Date.now(),
                members: [user.uid],
                ownerId: user.uid,
                clientId: user.uid,
                isPayLaterRequest: paymentOption === 'pay_later',
                clientName: user.displayName || 'Anonymous Client'
            };

            const projectRef = await addDoc(collection(db, "projects"), projectData);
            
            // 3. Trigger Server-side workflows
            await handleProjectCreated(projectRef.id);

            toast.success("Project created successfully!");
            router.push("/dashboard");

        } catch (error: any) {
            console.error("Error creating project:", error);
            toast.error("Something went wrong: " + error.message);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto min-h-[calc(100vh-8rem)] flex flex-col gap-8 pb-10">
            {/* Header / Stepper Layer */}
            <div className="flex flex-col items-center justify-center pt-8 pb-4">
                 <h1 className="text-4xl font-heading font-black tracking-tight text-foreground mb-8">
                     Create New <span className="text-primary">Project</span>
                 </h1>

                 {/* Stepper */}
                 <div className="flex items-center gap-4 w-full max-w-2xl px-4">
                    {[1, 2, 3, 4].map((step) => (
                         <div key={step} className="flex items-center flex-1 last:flex-none">
                             <div className={cn(
                                 "flex flex-col items-center justify-center gap-2",
                                 currentStep === step ? "opacity-100" : currentStep > step ? "opacity-80" : "opacity-30"
                             )}>
                                 <div className={cn(
                                     "h-10 w-10 flex items-center justify-center rounded-full font-bold transition-all border-2",
                                     currentStep === step 
                                         ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" 
                                         : currentStep > step
                                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-500"
                                            : "bg-muted border-border text-foreground/50"
                                 )}>
                                     {currentStep > step ? <CheckCircle2 className="h-5 w-5" /> : step}
                                 </div>
                                 <span className={cn(
                                     "text-[10px] font-bold uppercase tracking-widest text-center leading-none",
                                     currentStep >= step ? "text-primary" : "text-muted-foreground"
                                 )}>
                                     {step === 1 ? 'Info' : step === 2 ? 'Format' : step === 3 ? 'Upload' : 'Payment'}
                                 </span>
                             </div>
                             {step < 4 && (
                                 <div className={cn(
                                     "flex-1 h-0.5 mx-2 md:mx-4 rounded-full transition-all",
                                     currentStep > step ? "bg-emerald-500" : "bg-muted"
                                 )} />
                             )}
                         </div>
                     ))}
                 </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                {/* Step 1 */}
                {currentStep === 1 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold text-foreground">Project Information</h2>
                            <p className="text-sm text-muted-foreground">Provide the basic details for your new project.</p>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Project Name *</Label>
                                <Input 
                                    placeholder="e.g. Summer Campaign Video" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="h-12 bg-muted/50 border-border focus:border-primary/50 rounded-xl font-medium text-foreground placeholder:text-muted-foreground"
                                />
                            </div>



                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Delivery Time (Select One)</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setUrgency('24hrs')}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                                            urgency === '24hrs' 
                                                ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]" 
                                                : "bg-muted/50 border-border hover:border-border"
                                        )}
                                    >
                                        <div className={cn("p-2 rounded-lg", urgency === '24hrs' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className={cn("font-bold", urgency === '24hrs' ? "text-primary" : "text-foreground")}>Standard Delivery</p>
                                            <p className="text-xs text-muted-foreground font-medium">Get video in 24hrs</p>
                                        </div>
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={() => setUrgency('urgent')}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                                            urgency === 'urgent' 
                                                ? "bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
                                                : "bg-muted/50 border-border hover:border-border"
                                        )}
                                    >
                                        <div className={cn("p-2 rounded-lg", urgency === 'urgent' ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground")}>
                                            <Zap className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className={cn("font-bold", urgency === 'urgent' ? "text-amber-500" : "text-foreground")}>Urgent Delivery</p>
                                                <span className="text-[9px] font-black bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded uppercase">+Extra</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-medium">Prioritized queue delivery</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Project Description *</Label>
                                    <span className={cn("text-xs font-bold", wordCount > 100 ? "text-red-500" : "text-muted-foreground")}>{wordCount} / 100 words</span>
                                </div>
                                <Textarea 
                                    placeholder="Provide detailed instructions for the editor..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className={cn(
                                        "min-h-[120px] resize-none bg-muted/50 border-border rounded-xl font-medium text-foreground placeholder:text-muted-foreground",
                                        wordCount > 100 ? "border-red-500 focus:border-red-500" : "focus:border-primary/50"
                                    )}
                                />
                                {wordCount > 100 && <p className="text-xs text-red-500 font-medium">You have exceeded the 100 words limit.</p>}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleNextStep} size="lg" className="rounded-xl px-10 shadow-xl font-bold tracking-wide">
                                Next Step <ChevronRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Step 2 */}
                {currentStep === 2 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                         <div className="space-y-1">
                            <h2 className="text-2xl font-bold text-foreground">Video Format</h2>
                            <p className="text-sm text-muted-foreground">Select the aspect ratio and format for your video.</p>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Video Type Format</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {VIDEO_TYPES.map(vt => {
                                        const price = user?.customRates?.[vt.key] || BASE_PROJECT_PRICE;
                                        const hasCustomRate = user?.customRates?.[vt.key] !== undefined;
                                        const isSelected = videoType === vt.key;
                                        
                                        return (
                                            <button
                                                key={vt.key}
                                                type="button"
                                                onClick={() => setVideoType(vt.key)}
                                                className={cn(
                                                    "flex flex-col p-4 rounded-xl border transition-all text-left group",
                                                    isSelected
                                                        ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]" 
                                                        : "bg-muted/50 border-border hover:border-border hover:bg-muted/60"
                                                )}
                                            >
                                                <div className="flex flex-col w-full">
                                                    <div className="flex items-center justify-between mb-1 gap-1">
                                                        <span className={cn("text-xs font-bold", isSelected ? "text-primary" : "text-foreground")}>{vt.label}</span>
                                                        <span className={cn("text-[10px] font-mono font-bold", hasCustomRate ? "text-amber-500" : "text-emerald-500")}>₹{price}</span>
                                                    </div>
                                                    <span className="text-[9px] text-muted-foreground line-clamp-1">{vt.desc}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-3 pt-6 border-t border-border">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Select Aspect Ratio</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {ASPECT_RATIOS.map(ar => {
                                        const isSelected = aspectRatio === ar.key;
                                        const is9x16 = ar.key === "9:16";
                                        const is16x9 = ar.key === "16:9";
                                        const is1x1 = ar.key === "1:1";

                                        return (
                                            <button
                                                key={ar.key}
                                                type="button"
                                                onClick={() => setAspectRatio(ar.key)}
                                                className={cn(
                                                    "flex flex-col items-center p-6 rounded-2xl border transition-all group relative overflow-hidden",
                                                    isSelected
                                                        ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(var(--primary),0.15)]" 
                                                        : "bg-muted/30 border-border hover:border-border hover:bg-muted/50"
                                                )}
                                            >
                                                <div className="mb-4 flex items-center justify-center h-16 w-full">
                                                    <div 
                                                        className={cn(
                                                            "border-2 transition-all duration-300 rounded-sm flex items-center justify-center shadow-lg",
                                                            isSelected ? "border-primary bg-primary/20 text-primary scale-110" : "border-zinc-700 bg-muted-foreground/10 text-muted-foreground group-hover:border-zinc-500"
                                                        )}
                                                        style={{
                                                            width: is9x16 ? '24px' : is16x9 ? '56px' : '40px',
                                                            height: is9x16 ? '42px' : is16x9 ? '32px' : '40px',
                                                        }}
                                                    >
                                                        <span className="text-[8px] font-black">{ar.key}</span>
                                                    </div>
                                                </div>
                                                <span className={cn("text-[10px] font-black uppercase tracking-widest", isSelected ? "text-primary" : "text-foreground/80")}>{ar.label}</span>
                                                <span className="text-[9px] text-muted-foreground font-bold mt-1">{ar.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4">
                            <Button type="button" onClick={handlePrevStep} variant="ghost" size="lg" className="rounded-xl text-muted-foreground hover:text-foreground">
                                <ChevronLeft className="mr-2 w-4 h-4" /> Go Back
                            </Button>
                            <Button onClick={handleNextStep} size="lg" className="rounded-xl px-10 shadow-xl font-bold tracking-wide">
                                Next Step <ChevronRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                         <div className="space-y-1">
                            <h2 className="text-2xl font-bold text-foreground">Upload Assets & Scripts</h2>
                            <p className="text-sm text-muted-foreground">Provide all necessary files for the editor to begin working.</p>
                        </div>

                        <div className="space-y-8">
                            {/* Raw Video/Images */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                    <FileVideo className="w-4 h-4 text-primary" /> 
                                    Upload Raw Video / Images
                                </Label>
                                <div className="border-2 border-dashed border-border rounded-2xl p-8 hover:bg-muted/50 hover:border-primary/50 transition-all text-center relative overflow-hidden group">
                                    <input 
                                        type="file" 
                                        multiple
                                        accept="video/*,image/*"
                                        onChange={(e) => handleFileUpload(e, 'raw')}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <UploadCloud className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-foreground">Click or drag files to upload</p>
                                            <p className="text-xs text-muted-foreground font-medium tracking-tight">Support for mp4, mov, jpg, png</p>
                                        </div>
                                    </div>
                                </div>
                                {/* File List with Progress */}
                                {rawFiles.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        {rawFiles.map((fileItem, i) => (
                                            <div key={i} className="bg-muted/50 border border-border rounded-lg p-3 group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        {fileItem.file.type.includes('image') ? <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" /> : <FileVideo className="w-4 h-4 text-blue-500 shrink-0" />}
                                                        <span className="text-xs text-foreground truncate font-medium">{fileItem.file.name}</span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            ({(fileItem.file.size / 1024 / 1024).toFixed(1)} MB)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {fileItem.status === 'complete' && (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                        )}
                                                        {fileItem.status === 'error' && (
                                                            <AlertCircle className="w-4 h-4 text-red-500" />
                                                        )}
                                                        {fileItem.status === 'uploading' && (
                                                            <span className="text-[10px] text-primary font-bold">{Math.round(fileItem.progress)}%</span>
                                                        )}
                                                        <button type="button" onClick={() => removeFile(i, 'raw')} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-red-500 rounded transition-all">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {(fileItem.status === 'uploading' || fileItem.status === 'pending') && (
                                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
                                                            style={{ width: `${fileItem.progress}%` }}
                                                        />
                                                    </div>
                                                )}
                                                {fileItem.status === 'error' && (
                                                    <p className="text-[10px] text-red-500 mt-1">{fileItem.error || 'Upload failed'}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Scripts */}
                            <div className="space-y-3 pt-4 border-t border-border">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" /> 
                                    Script / Direction
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="border border-dashed border-border rounded-xl p-6 hover:bg-muted/50 hover:border-primary/50 transition-all text-center relative overflow-hidden group h-full flex flex-col items-center justify-center">
                                            <input 
                                                type="file" 
                                                multiple
                                                accept=".pdf,.doc,.docx,.txt"
                                                onChange={(e) => handleFileUpload(e, 'script')}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <FileText className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                                            <p className="text-xs font-bold text-foreground">Upload Script File</p>
                                            <p className="text-[10px] text-muted-foreground">PDF, DOC, TXT</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Textarea 
                                            placeholder="Or directly paste your script here..."
                                            value={scriptText}
                                            onChange={e => setScriptText(e.target.value)}
                                            className="h-full min-h-[140px] resize-none bg-muted/50 border-border rounded-xl font-medium text-foreground placeholder:text-muted-foreground text-xs leading-relaxed"
                                        />
                                    </div>
                                </div>
                                {/* Script Files List with Progress */}
                                {scriptFiles.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        {scriptFiles.map((fileItem, i) => (
                                            <div key={i} className="bg-muted/50 border border-border rounded-lg p-3 group">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <FileText className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                        <span className="text-xs text-foreground truncate font-medium">{fileItem.file.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {fileItem.status === 'complete' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                                        {fileItem.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                        {fileItem.status === 'uploading' && (
                                                            <span className="text-[10px] text-primary font-bold">{Math.round(fileItem.progress)}%</span>
                                                        )}
                                                        <button type="button" onClick={() => removeFile(i, 'script')} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {(fileItem.status === 'uploading' || fileItem.status === 'pending') && (
                                                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-pink-500 to-pink-400 transition-all duration-300"
                                                            style={{ width: `${fileItem.progress}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Google Drive Link */}
                            <div className="space-y-2 pt-4 border-t border-border">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                    <LinkIcon className="w-4 h-4 text-emerald-500" /> 
                                    Google Drive Link (Optional)
                                </Label>
                                <Input 
                                    placeholder="Paste URL here..." 
                                    value={footageLink}
                                    onChange={e => setFootageLink(e.target.value)}
                                    className="h-12 bg-muted/50 border-border focus:border-emerald-500/50 rounded-xl font-medium text-foreground placeholder:text-muted-foreground"
                                />
                            </div>

                            {/* Reference Link & Files */}
                            <div className="space-y-4 pt-6 mt-6 border-t-2 border-primary/20 bg-primary/5 p-6 rounded-2xl">
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                        <Zap className="h-4 w-4" /> Style Reference (Optional)
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Share a link or upload a file that shows your desired style</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                         <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Reference URL</Label>
                                         <Input 
                                            placeholder="Instagram/YouTube link..." 
                                            value={referenceLink}
                                            onChange={e => setReferenceLink(e.target.value)}
                                            className="h-11 bg-background/50 border-border rounded-xl text-xs"
                                         />
                                     </div>
                                     <div className="space-y-2">
                                         <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Reference File(s)</Label>
                                         <div className="relative h-11 border border-dashed border-border rounded-xl flex items-center justify-center hover:bg-background/40 transition-colors cursor-pointer group">
                                             <input 
                                                type="file" 
                                                multiple
                                                onChange={(e) => handleFileUpload(e, 'reference')}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                             />
                                             <UploadCloud className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                             <span className="ml-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">Attach File</span>
                                         </div>
                                     </div>
                                </div>
                                {referenceFiles.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        {referenceFiles.map((fileItem, i) => (
                                            <div key={i} className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 group">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-bold text-primary truncate max-w-[150px]">{fileItem.file.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        {fileItem.status === 'complete' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                                        {fileItem.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                                                        {fileItem.status === 'uploading' && (
                                                            <span className="text-[9px] text-primary font-bold">{Math.round(fileItem.progress)}%</span>
                                                        )}
                                                        <button onClick={() => removeFile(i, 'reference')} className="text-primary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {(fileItem.status === 'uploading' || fileItem.status === 'pending') && (
                                                    <div className="h-1 bg-primary/20 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-primary transition-all duration-300"
                                                            style={{ width: `${fileItem.progress}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Overall Upload Progress */}
                        {(rawFiles.length > 0 || scriptFiles.length > 0 || referenceFiles.length > 0) && (
                            <div className="bg-muted/30 border border-border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                        Upload Progress
                                    </span>
                                    <span className={cn(
                                        "text-xs font-bold",
                                        allFilesUploaded ? "text-emerald-500" : hasUploadingFiles ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {allFilesUploaded ? (
                                            <span className="flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> All Files Uploaded
                                            </span>
                                        ) : hasUploadingFiles ? (
                                            `${totalUploadProgress}% Complete`
                                        ) : (
                                            'Ready'
                                        )}
                                    </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div 
                                        className={cn(
                                            "h-full transition-all duration-500",
                                            allFilesUploaded 
                                                ? "bg-gradient-to-r from-emerald-500 to-emerald-400" 
                                                : "bg-gradient-to-r from-primary to-primary/70"
                                        )}
                                        style={{ width: `${totalUploadProgress}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                                    <span>{rawFiles.length + scriptFiles.length + referenceFiles.length} file(s)</span>
                                    <span>
                                        {[...rawFiles, ...scriptFiles, ...referenceFiles].filter(f => f.status === 'complete').length} uploaded
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4">
                            <Button type="button" onClick={handlePrevStep} variant="ghost" size="lg" className="rounded-xl text-muted-foreground hover:text-foreground">
                                <ChevronLeft className="mr-2 w-4 h-4" /> Go Back
                            </Button>
                            <Button 
                                onClick={handleNextStep} 
                                size="lg" 
                                className="rounded-xl px-10 shadow-xl font-bold tracking-wide"
                                disabled={hasUploadingFiles}
                            >
                                {hasUploadingFiles ? (
                                    <>Uploading... {totalUploadProgress}%</>
                                ) : (
                                    <>Next Step <ChevronRight className="ml-2 w-4 h-4" /></>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Step 4 */}
                {currentStep === 4 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                         <div className="space-y-1">
                            <h2 className="text-2xl font-bold text-foreground">Review & Payment</h2>
                            <p className="text-sm text-muted-foreground">Review your final cost and select a payment method.</p>
                        </div>

                        <div className="bg-[#0b0c0f] border border-border rounded-2xl p-6 md:p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-4 border-b border-border">
                                    <span className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Base Project Cost</span>
                                    <div className="flex items-center font-bold text-foreground">
                                        <IndianRupee className="w-4 h-4 mr-1 text-muted-foreground" />
                                        {basePrice.toLocaleString()}
                                    </div>
                                </div>
                                {urgency === 'urgent' && (
                                    <div className="flex justify-between items-center pb-4 border-b border-border">
                                        <span className="text-sm text-amber-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                            <Zap className="w-4 h-4" /> Urgent Delivery
                                        </span>
                                        <div className="flex items-center font-bold text-amber-500">
                                            + <IndianRupee className="w-4 h-4 mx-1" />
                                            {DEFAULT_URGENT_PRICE.toLocaleString()}
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-lg text-foreground font-black">Total Cost</span>
                                    <div className="flex items-center text-3xl font-black text-primary">
                                        <IndianRupee className="w-6 h-6 mr-1" />
                                        {finalCost.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submission Status */}
                        {isSubmitting && (
                            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                <div>
                                    <p className="text-sm font-bold text-foreground">Creating Your Project...</p>
                                    <p className="text-xs text-muted-foreground">This will only take a moment</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <Button 
                                type="button"
                                disabled={true}
                                size="lg" 
                                className="h-14 rounded-xl font-bold tracking-wide w-full opacity-50"
                            >
                                <CreditCard className="w-5 h-5 mr-3 opacity-50" />
                                Pay Now (Coming Soon)
                            </Button>
                            
                            {canPayLater ? (
                                <Button 
                                    onClick={() => handleSubmitProject('pay_later')} 
                                    disabled={isSubmitting}
                                    variant="outline"
                                    size="lg" 
                                    className="h-14 rounded-xl font-bold tracking-wide w-full border-primary/50 text-primary hover:bg-primary/10"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Clock className="w-5 h-5 mr-3" />}
                                    Pay Later
                                </Button>
                            ) : (
                                <div className="h-14 rounded-xl border border-dashed border-border flex items-center justify-center text-xs font-bold text-muted-foreground uppercase tracking-widest w-full">
                                    Pay Later Disabled
                                </div>
                            )}
                        </div>

                        {!isSubmitting && (
                            <div className="flex justify-start pt-2">
                                <Button type="button" onClick={handlePrevStep} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                    <ChevronLeft className="mr-1 w-3 h-3" /> Back to Uploads
                                </Button>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

