"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/context/auth-context";
import { Invoice } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileText, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function InvoicesPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    const isAdmin = user?.role === 'admin' || user?.role === 'sales_executive' || user?.role === 'manager';

    useEffect(() => {
        if (!user) return;

        let q;
        if (isAdmin) {
            q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
        } else {
            // Client View
            q = query(
                collection(db, "invoices"), 
                where("clientId", "==", user.uid),
                orderBy("createdAt", "desc") // might require index
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Invoice[] = [];
            snapshot.forEach(doc => {
                 list.push({ id: doc.id, ...doc.data() } as Invoice);
            });
            setInvoices(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, isAdmin]);

    const filteredInvoices = invoices.filter(inv => 
        inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 space-y-8 min-h-screen bg-zinc-950 text-white">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
                    <p className="text-zinc-400">Manage and view payment requests.</p>
                </div>
                {isAdmin && (
                    <Link href="/dashboard/invoices/create">
                        <Button className="gap-2 bg-primary hover:bg-primary/90">
                            <Plus className="h-4 w-4" /> Create Invoice
                        </Button>
                    </Link>
                )}
            </div>

            <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                <Search className="h-5 w-5 text-zinc-500" />
                <Input 
                    placeholder="Search by client or invoice #..." 
                    className="bg-transparent border-none focus-visible:ring-0 text-sm h-auto p-0 placeholder:text-zinc-600"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="text-center py-20 text-zinc-500">Loading invoices...</div>
            ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl">
                    <FileText className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
                    <p className="text-zinc-400 font-medium">No invoices found</p>
                    {isAdmin && (
                        <Link href="/dashboard/invoices/create" className="text-primary text-sm hover:underline mt-2 inline-block">
                            Create your first invoice
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredInvoices.map((invoice) => (
                        <div key={invoice.id} className="group flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-white/5 hover:border-white/10 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs">
                                    {invoice.status === 'paid' ? '$$' : 'INV'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-white">{invoice.invoiceNumber}</span>
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider",
                                            invoice.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" :
                                            invoice.status === 'sent' ? "bg-blue-500/10 text-blue-500" :
                                            invoice.status === 'overdue' ? "bg-red-500/10 text-red-500" :
                                            "bg-zinc-500/10 text-zinc-500"
                                        )}>
                                            {invoice.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-500 mt-0.5">{invoice.clientName} • Due {format(invoice.dueDate, "MMM dd, yyyy")}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">${invoice.total.toLocaleString()}</p>
                                    <p className="text-xs text-zinc-500">Total Amount</p>
                                </div>
                                <Link href={`/invoices/${invoice.id}`}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
