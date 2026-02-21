"use client";

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { CURRENCY } from "@/lib/razorpay";
import { updateDoc, doc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// Function to load script dynamically
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};


import { User } from "@/types/schema";

interface PaymentButtonProps {
    projectId: string;
    user?: User | null;
    amount: number;
    description: string;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    onSuccess?: () => void;
    className?: string;
}

export function PaymentButton({ projectId, user, amount, description, prefill, onSuccess, className }: PaymentButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handlePayment = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent bubbling if inside a link
        e.stopPropagation();
        
        setIsLoading(true);

        try {
            // 1. Load Script
            const res = await loadRazorpayScript();
            if (!res) {
                toast.error("Razorpay SDK failed to load. Are you online?");
                setIsLoading(false);
                return;
            }

            // 2. Create Order
            const orderRes = await fetch("/api/create-order", {
                method: "POST",
                body: JSON.stringify({ amount, projectId }),
                headers: { "Content-Type": "application/json" }
            });
            const orderData = await orderRes.json();

            if (!orderRes.ok) throw new Error(orderData.error);

            // 3. Open Razorpay
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "EditoHub Studio",
                description: description,
                order_id: orderData.id,
                handler: async function (response: any) {
                    try {
                        // verify on server
                        const verifyRes = await fetch("/api/verify-payment", {
                            method: "POST",
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                projectId,
                                amount,
                                paymentType: 'final' // Assuming PaymentButton is largely used for completion/final payments or we can pass this as prop
                            }),
                            headers: { "Content-Type": "application/json" }
                        });
                        
                        const verifyData = await verifyRes.json();
                        if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed");

                        toast.success("Payment Verified & Successful!");
                        if (onSuccess) onSuccess();

                    } catch (err: any) {
                        console.error("Verification failed", err);
                        toast.error("Payment successful but verification failed: " + err.message);
                    }
                },
                prefill: {
                    name: prefill?.name || "",
                    email: prefill?.email || "",
                    contact: prefill?.contact || "",
                },
                theme: {
                    color: "#D946EF",
                },
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.open();

        } catch (error: any) {
            console.error("Payment Error:", error);
            toast.error("Payment failed: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (user?.payLater) {
        return (
            <div className={`p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center ${className || ''}`}>
                 <p className="text-sm font-medium text-blue-400 mb-1">Pay Later Enabled</p>
                 <p className="text-xs text-zinc-400">Please contact your Project Manager to settle payment. Downloads will be unlocked manually after verification.</p>
            </div>
        );
    }

    return (
        <button
            onClick={handlePayment}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50 ${className || ''}`}
        >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Pay ₹{amount.toLocaleString()}
        </button>
    );
}
