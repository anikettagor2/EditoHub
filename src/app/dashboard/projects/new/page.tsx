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
import { Loader2, Clock, CheckCircle, Clapperboard, MonitorPlay, Smartphone, Palette, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CURRENCY } from "@/lib/razorpay";

const VIDEO_TYPES = [
    { id: "Short Videos", label: "Short Videos", icon: Clapperboard, price: 500 },
    { id: "Long Videos", label: "Long Videos", icon: MonitorPlay, price: 1000 },
    { id: "Reels", label: "Reels / TikTok", icon: Smartphone, price: 500 },
    { id: "Graphics Videos", label: "Motion Graphics", icon: Palette, price: 1500 },
    { id: "Ads/UGC Videos", label: "Ads / UGC", icon: Megaphone, price: 2000 }
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

            // 2. Create Project
            const projectData = {
                name,
                brand,
                description,
                videoType,
                duration: 0, 
                budget: estimatedCost,
                totalCost: estimatedCost,
                amountPaid: 0, 
                paymentStatus: 'pending_payment',
                deadline: null, 
                footageLink, 
                rawFiles: uploadedFileMetadata ? [uploadedFileMetadata] : [], 
                status: 'pending_payment', // Initial status before payment
                createdAt: Date.now(),
                updatedAt: Date.now(),
                members: [user.uid],
                ownerId: user.uid
            };

            const docRef = await addDoc(collection(db, "projects"), projectData);

            // 2. Initialize Payment
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                 toast.error("Payment gateway failed to load");
                 setIsSubmitting(false);
                 return;
            }

            // Calculate 50% Upfront
            const upfrontPayment = Math.round(estimatedCost * 0.5);

            // 3. Create Order
            const orderRes = await fetch("/api/create-order", {
                method: "POST",
                body: JSON.stringify({ amount: upfrontPayment, projectId: docRef.id }),
                headers: { "Content-Type": "application/json" }
            });
            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error || "Order creation failed");

            // 4. Update Project with initial payment status pending
            // (Client pays upfrontPayment, but totalCost remains full)
            await updateDoc(doc(db, "projects", docRef.id), {
                amountPaid: 0, // Will be updated on verification
                paymentStatus: 'pending_initial_payment'
            });

            // 5. Open Razorpay
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "EditoHub Studio",
                description: `50% Advance for ${videoType}`,
                order_id: orderData.id,
                handler: async function (response: any) {
                    // Payment Success -> Verify
                    try {
                        const verifyRes = await fetch("/api/verify-payment", {
                            method: "POST",
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                projectId: docRef.id,
                                amount: upfrontPayment,
                                paymentType: 'initial' 
                            }),
                            headers: { "Content-Type": "application/json" }
                        });

                        const verifyData = await verifyRes.json();
                        if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");

                        // Success Actions
                        toast.success("Advance Payment successful!");
                        toast.info("Your project has been posted for assignment.");
                        router.push("/dashboard");

                    } catch (err: any) {
                        console.error("Error verifying project payment:", err);
                        toast.error("Payment received but verification failed: " + err.message);
                    }
                },
                theme: { color: "#D946EF" },
                prefill: {
                    name: user.displayName || "",
                    email: user.email || "",
                }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.open();
            
            // Note: isSubmitting stays true until redirection or error

        } catch (error: any) {
            console.error("Error creating project:", error);
            toast.error("Failed: " + error.message);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="mb-10">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    Start New Project
                </h1>
                <p className="text-zinc-400 mt-2">
                    Submit your video details. We'll review and assign the best editor for you.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Form */}
                <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
                    
                    {/* Section 1: Basic Info */}
                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">1</span>
                            Project Info
                        </h2>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Project Name</Label>
                                <Input 
                                    placeholder="e.g. Summer Campaign" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Brand Name</Label>
                                <Input 
                                    placeholder="e.g. Acme Corp" 
                                    value={brand}
                                    onChange={e => setBrand(e.target.value)}
                                    required
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description & Requirements</Label>
                            <Textarea 
                                placeholder="Describe the editing style, mood, and specific requirements..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="min-h-[120px] bg-black/40 border-white/10"
                                required
                            />
                        </div>
                    </div>

                    {/* Section 2: Type Selection */}
                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 backdrop-blur-sm">
                         <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">2</span>
                            Video Type & Pricing
                        </h2>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {VIDEO_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isSelected = videoType === type.id;
                                
                                // Visibility Check
                                if (user?.allowedFormats && user.allowedFormats[type.id] === false) {
                                    return null;
                                }

                                // Check for custom rate for this user, otherwise use default
                                const finalPrice = (user?.customRates && user.customRates[type.id]) 
                                    ? user.customRates[type.id] 
                                    : type.price;

                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setVideoType(type.id)}
                                        className={cn(
                                            "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 relative overflow-hidden",
                                            isSelected 
                                                ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10" 
                                                : "bg-black/20 border-white/5 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <Icon className={cn("w-6 h-6 mb-1", isSelected ? "text-primary" : "text-zinc-500")} />
                                        <span className="text-xs font-medium text-center">{type.label}</span>
                                        <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold mt-1", 
                                            isSelected ? "bg-primary text-white" : "bg-white/10 text-zinc-400"
                                        )}>
                                            ₹{finalPrice}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>


                    {/* Section 3: Footage (Upload or Link) */}
                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 backdrop-blur-sm">
                         <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">3</span>
                            Footage & Assets
                        </h2>
                        
                        <div className="space-y-4">
                            {/* File Upload */}
                            <div className="space-y-2">
                                <Label>Upload Raw Video Files</Label>
                                <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-primary/50 transition-colors bg-black/20 group cursor-pointer relative">
                                    <input 
                                        type="file" 
                                        accept="video/*,image/*,.zip,.rar"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setRawFile(e.target.files[0]);
                                            }
                                        }}
                                    />
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                             <Clapperboard className="h-5 w-5" />
                                        </div>
                                        {rawFile ? (
                                            <div className="text-sm font-medium text-primary">
                                                Selected: {rawFile.name} ({(rawFile.size / (1024 * 1024)).toFixed(2)} MB)
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm font-medium text-zinc-300">Click to upload raw footage</p>
                                                <p className="text-xs text-zinc-500">Supported: MP4, MOV, ZIP (Max 2GB recommended)</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {uploadProgress > 0 && uploadProgress < 100 && (
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                                        <div 
                                            className="h-full bg-primary transition-all duration-300" 
                                            style={{ width: `${uploadProgress}%` }} 
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-zinc-900 px-2 text-zinc-500">Or share link</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Cloud Storage Link (Optional)</Label>
                                <Input 
                                    placeholder="Google Drive, Dropbox, or WeTransfer link..." 
                                    value={footageLink}
                                    onChange={e => setFootageLink(e.target.value)}
                                    className="bg-black/40 border-white/10"
                                />
                                <p className="text-xs text-zinc-500">
                                    Paste a link if your files are already hosted elsewhere.
                                </p>
                            </div>
                        </div>
                    </div>

                </form>

                {/* Right Column: Order Summary */}
                <div className="lg:col-span-1">
                    <div className="sticky top-10 bg-zinc-900 border border-white/10 rounded-2xl p-6  shadow-2xl shadow-purple-900/10">
                        <h3 className="text-lg font-semibold mb-6">Summary</h3>
                        
                        <div className="space-y-4 text-sm">
                             <div className="flex justify-between text-zinc-400">
                                <span>Type</span>
                                <span className="text-white font-medium">{videoType}</span>
                            </div>
                            <div className="flex justify-between text-zinc-400">
                                <span>Base Price</span>
                                <span>₹{estimatedCost}</span>
                            </div>
                            <div className="h-px bg-white/10 my-4" />
                            <div className="flex justify-between text-lg font-semibold">
                                <span>Total Estimate</span>
                                <span>₹{estimatedCost}</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 text-right">
                                *Final price may vary based on specific requirements
                            </p>
                            
                            <div className="mt-4 p-3 bg-primary/10 rounded-lg text-xs text-zinc-300 flex gap-2">
                                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                                We'll review your project and assign the best team.
                            </div>
                        </div>

                        <Button 
                            onClick={handleSubmit}
                            disabled={isSubmitting || !name || !description}
                            className="w-full mt-6 bg-primary hover:bg-primary/90 py-6 text-lg font-semibold shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin" /> Processing Payment...
                                </span>
                            ) : (
                                `Pay ₹${estimatedCost} & Post`
                            )}
                        </Button>
                        
                        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
                            <Clock className="w-3 h-3" />
                            <span>Response typically in ~2 hours</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
