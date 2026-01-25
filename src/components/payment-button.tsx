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

interface PaymentButtonProps {
    projectId: string;
    amount: number;
    description: string;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    onSuccess?: () => void;
}

export function PaymentButton({ projectId, amount, description, prefill, onSuccess }: PaymentButtonProps) {
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
                    toast.success("Payment Successful!");
                    
                    // Update Database
                    // Note: Ideally call a server action here to verify signature securely
                    // Fetch fresh doc to be safe or use increment

                    const isFullPayment = description.includes("Balance") || description.includes("full") || description.includes("Remaining");
                    const newStatus = isFullPayment ? 'full_paid' : 'half_paid';

                    await updateDoc(doc(db, "projects", projectId), {
                        amountPaid: increment(amount), 
                        paymentStatus: newStatus,
                        razorpayPaymentId: response.razorpay_payment_id,
                        updatedAt: Date.now()
                    });

                    if (onSuccess) onSuccess();
                },
                prefill: {
                    name: prefill?.name || "",
                    email: prefill?.email || "",
                    contact: prefill?.contact || "",
                },
                theme: {
                    color: "#D946EF", // Standard primary color
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

    return (
        <button
            onClick={handlePayment}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50"
        >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Pay ₹{amount.toLocaleString()}
        </button>
    );
}
