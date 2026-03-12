"use client";

import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Invoice } from "@/types/schema";
import { InvoiceRenderer } from "@/components/invoice/invoice-renderer";
import { getInvoiceSettings } from "@/app/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, CreditCard, CheckCircle2, Pencil } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";
import Link from "next/link";
import { PaymentButton } from "@/components/payment-button";
import { toast } from "sonner";

export default function InvoicePage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params); 
    const { user } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [invoiceSettings, setInvoiceSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);

    const isAdmin = user?.role === 'admin' || user?.role === 'sales_executive' || user?.role === 'manager';

    useEffect(() => {
        async function fetchInvoice() {
            try {
                const docRef = doc(db, "invoices", params.id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setInvoice({ id: snap.id, ...snap.data() } as Invoice);
                }
                
                // Fetch invoice settings
                const settingsRes = await getInvoiceSettings();
                if (settingsRes.success) {
                    setInvoiceSettings(settingsRes.data);
                }
            } catch (error) {
                console.error("Error fetching invoice:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchInvoice();
    }, [params.id]);

    const handlePaymentSuccess = async () => {
        if (!invoice) return;
        try {
            await updateDoc(doc(db, "invoices", invoice.id), {
                status: 'paid',
                updatedAt: Date.now()
            });
            setInvoice(prev => prev ? { ...prev, status: 'paid' } : null);
            toast.success("Payment successful! Invoice marked as paid.");
        } catch (error) {
            console.error("Payment update failed:", error);
            toast.error("Payment succeeded but status update failed per network error.");
        }
    };

    if (loading) return <div className="text-center py-20">Loading Invoice...</div>;
    if (!invoice) return <div className="text-center py-20 text-red-500">Invoice not found or deleted.</div>;

    return (
        <div className="min-h-screen bg-zinc-100 print:bg-primary  text-zinc-900 flex flex-col items-center py-12 md:py-20 invoice-page">
            
            {/* Action Bar (Hidden when printing) */}
            <div className="w-full max-w-[210mm] mb-8 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden px-4 md:px-0">
                <Link href="/dashboard/invoices" className="flex items-center text-sm font-medium text-muted-foreground hover:text-zinc-900 transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
                </Link>
                
                <div className="flex gap-3">
                    {isAdmin && (
                        <Link href={`/dashboard/invoices/${params.id}/edit`}>
                            <Button variant="outline" className="gap-2 bg-primary hover:bg-zinc-50 border-zinc-200 text-muted-foreground">
                                <Pencil className="h-4 w-4" /> Edit
                            </Button>
                        </Link>
                    )}
                    <Button onClick={() => window.print()} variant="outline" className="gap-2 bg-primary  hover:bg-zinc-50 border-zinc-200 text-muted-foreground">
                        <Printer className="h-4 w-4" /> Print / Save PDF
                    </Button>
                    
                    {invoice.status !== 'paid' ? (
                        <div className="relative">
                            <PaymentButton 
                                projectId={invoice.projectId || "generic-invoice"} // Fallback if not linked to project
                                amount={invoice.total}
                                description={`Payment for Invoice #${invoice.invoiceNumber}`}
                                prefill={{
                                    name: invoice.clientName,
                                    email: invoice.clientEmail
                                }}
                                onSuccess={handlePaymentSuccess}
                                className="bg-emerald-600 hover:bg-emerald-700 text-foreground shadow-lg shadow-emerald-500/20"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-md font-medium text-sm">
                            <CheckCircle2 className="h-4 w-4" /> Paid in Full
                        </div>
                    )}
                </div>
            </div>

            {/* Render Invoice */}
            <div className="w-full max-w-[210mm] bg-primary  shadow-xl print:shadow-none print:w-full">
                <InvoiceRenderer invoice={invoice} settings={invoiceSettings} />
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background: white;
                    }
                    .invoice-page {
                        padding: 0;
                        margin: 0;
                        display: block;
                    }
                    /* Ensure background graphics (colors) are printed */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
}
