"use client";


import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, updateDoc, doc, query, where, getDocs } from "firebase/firestore";
import { db, storage } from "@/lib/firebase/config";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";  
import { Loader2, UploadCloud, DollarSign, Clock, Calendar, FileVideo, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CURRENCY } from "@/lib/razorpay";

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
    const [duration, setDuration] = useState<number>(1); // minutes
    const [budget, setBudget] = useState<number>(0);
    const [deadline, setDeadline] = useState("");
    const [footageLink, setFootageLink] = useState("");
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

    // Derived Cost Logic
    const totalCost = budget; 
    const upfrontPayment = totalCost * 0.5;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        setIsSubmitting(true);
        // Step 1: Create Project (Pending Payment)
        setProgress(30);

        try {
            const projectData = {
                name,
                brand,
                description,
                duration,
                budget,
                totalCost,
                amountPaid: 0, 
                paymentStatus: 'pending_payment', 
                deadline,
                footageLink, 
                rawFiles: [], 
                status: 'pending_assignment', 
                createdAt: Date.now(),
                updatedAt: Date.now(),
                members: [user.uid],
                ownerId: user.uid
            };

            const docRef = await addDoc(collection(db, "projects"), projectData);
            setCreatedProjectId(docRef.id);
            setProgress(50);

            // Step 2: Trigger Payment
            const res = await loadRazorpayScript();
            if (!res) {
                 toast.error("Razorpay SDK failed to load.");
                 setIsSubmitting(false);
                 return;
            }

            // Create Order
            const orderRes = await fetch("/api/create-order", {
                method: "POST",
                body: JSON.stringify({ amount: upfrontPayment, projectId: docRef.id }),
                headers: { "Content-Type": "application/json" }
            });
            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error || "Order creation failed");

            setProgress(70);

            // Open Razorpay
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_S5UPDlLBFMwNBd",
                amount: orderData.amount,
                currency: orderData.currency,
                name: "EditoHub Studio",
                description: `Project Deposit for ${name}`,
                order_id: orderData.id,
                handler: async function (response: any) {
                    // Payment Success
                    setProgress(90);
                    toast.success("Payment Received!");
                    
                    // Update Project
                    await updateDoc(doc(db, "projects", docRef.id), {
                         amountPaid: upfrontPayment,
                         paymentStatus: 'half_paid',
                         razorpayPaymentId: response.razorpay_payment_id,
                         status: 'pending_assignment', 
                         updatedAt: Date.now()
                    });
                    
                    setProgress(100);
                    setIsSubmitting(false);

                    toast.success("Project posted successfully!");
                    toast.info("An admin will assign an editor shortly.");
                    router.push("/dashboard");
                },
                theme: { color: "#D946EF" }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.open();

        } catch (error: any) {
            console.error("Error creating project/payment:", error);
            toast.error("Failed: " + error.message);
            setIsSubmitting(false);
            setProgress(0);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="mb-10">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    Create New Project
                </h1>
                <p className="text-zinc-400 mt-2">
                    Tell us what you need. We'll handle the rest.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Form */}
                <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
                    
                    {/* Section 1: Basic Info */}
                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">1</span>
                            Project Details
                        </h2>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Project Name</Label>
                                <Input 
                                    placeholder="e.g. Summer Campaign 2024" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Brand Name</Label>
                                <Input 
                                    placeholder="e.g. Nike" 
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

                    {/* Section 2: Logistics */}
                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 backdrop-blur-sm">
                         <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">2</span>
                            Logistics
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-zinc-400" />
                                    Target Length (min)
                                </Label>
                                <Input 
                                    type="number" 
                                    min="1"
                                    value={duration}
                                    onChange={e => setDuration(Number(e.target.value))}
                                    className="bg-black/40 border-white/10"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-zinc-400" />
                                    Deadline
                                </Label>
                                <Input 
                                    type="date" 
                                    value={deadline}
                                    onChange={e => setDeadline(e.target.value)}
                                    required
                                    className="bg-black/40 border-white/10 text-white"
                                />
                            </div>
                             <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-zinc-400" />
                                    Your Budget (₹)
                                </Label>
                                <Input 
                                    type="number" 
                                    placeholder="5000"
                                    value={budget || ''}
                                    onChange={e => setBudget(Number(e.target.value))}
                                    required
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                        </div>
                    </div>


                    {/* Section 3: Footage Link (Optional) */}
                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 backdrop-blur-sm">
                         <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">3</span>
                            Link to Footage (Optional)
                        </h2>
                        
                        <div className="space-y-2">
                            <Label>Cloud Storage Link</Label>
                            <Input 
                                placeholder="e.g. Google Drive, Dropbox, or WeTransfer link..." 
                                value={footageLink}
                                onChange={e => setFootageLink(e.target.value)}
                                className="bg-black/40 border-white/10"
                            />
                            <p className="text-xs text-zinc-500">
                                Since we are currently optimizing our upload servers, please provide a direct link to your raw files if available. You can also share this later with your editor.
                            </p>
                        </div>
                    </div>

                </form>

                {/* Right Column: Order Summary */}
                <div className="lg:col-span-1">
                    <div className="sticky top-10 bg-zinc-900 border border-white/10 rounded-2xl p-6  shadow-2xl shadow-purple-900/10">
                        <h3 className="text-lg font-semibold mb-6">Order Summary</h3>
                        
                        <div className="space-y-4 text-sm">
                             <div className="flex justify-between text-zinc-400">
                                <span>Editing (approx. {duration} mins)</span>
                                <span>-</span>
                            </div>
                            <div className="flex justify-between text-zinc-400">
                                <span>Client Budget</span>
                                <span>₹{(budget || 0).toLocaleString()}</span>
                            </div>
                            <div className="h-px bg-white/10 my-4" />
                            <div className="flex justify-between text-lg font-semibold">
                                <span>Total Estimate</span>
                                <span>₹{(totalCost || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="mt-8 bg-primary/10 border border-primary/20 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-primary">Pay Now (50%)</span>
                                <span className="text-xl font-bold text-white">₹{(upfrontPayment || 0).toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400">
                                Total project value: ₹{(totalCost || 0).toLocaleString()}. Setup payment to proceed.
                            </p>
                        </div>

                        <Button 
                            onClick={handleSubmit}
                            disabled={isSubmitting || !name || !deadline || !budget}
                            className="w-full mt-6 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 py-6 text-lg font-semibold shadow-lg shadow-purple-500/25"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin" /> Processing Payment...
                                </span>
                            ) : (
                                "Pay & Post Project"
                            )}
                        </Button>
                        
                        {isSubmitting && (
                             <div className="mt-4 space-y-1">
                                <div className="flex justify-between text-[10px] text-zinc-500">
                                    <span>Processing...</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
                            <Clock className="w-3 h-3" />
                            <span>Editors respond in ~2 hours</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
