"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, Mail, Lock, User, LogOut, RefreshCw, Copy, ExternalLink, Shield } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase/config";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { cn } from "@/lib/utils";

export function SalesDashboard() {
    const { user, logout } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [myClients, setMyClients] = useState<any[]>([]);
    
    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [customRates, setCustomRates] = useState<Record<string, number>>({
        "Short Videos": 500,
        "Long Videos": 1000,
        "Reels": 500,
        "Graphics Videos": 1500,
        "Ads/UGC Videos": 2000
    });
    const [allowedFormats, setAllowedFormats] = useState<Record<string, boolean>>({
        "Short Videos": false,
        "Long Videos": false,
        "Reels": false,
        "Graphics Videos": false,
        "Ads/UGC Videos": false
    });
    const [pendingClients, setPendingClients] = useState<any[]>([]);

    const VIDEO_TYPES_LABELS = [
        "Short Videos", "Long Videos", "Reels", "Graphics Videos", "Ads/UGC Videos"
    ];

    // Fetch Clients Managed by Current User
    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, "users"),
            where("managedBy", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMyClients(clients);
        }, (error) => {
            console.error("Error fetching clients:", error);
            // If index is missing, it will log a link to create it.
            // Fallback to client-side sorting if needed, but index is better.
        });

        return () => unsubscribe();
    }, [user]);

    // Merge pending and real clients, favoring real ones (from DB) if email matches
    const displayedClients = [...myClients, ...pendingClients]
        .filter((client, index, self) => 
            index === self.findIndex(t => t.email === client.email)
        )
        .sort((a, b) => b.createdAt - a.createdAt);

    const generatePassword = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
        let pass = "";
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setPassword(pass);
        toast.info("Secure password generated");
    };

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Backup current state for rollback
        const backup = { name, email, password, customRates, allowedFormats };
        const tempId = `temp-${Date.now()}`;

        // 1. Optimistic Update (Instant Feedback)
        const tempClient = {
            id: tempId,
            displayName: name,
            email: email,
            initialPassword: password,
            createdAt: Date.now(),
            role: 'client',
            customRates,
            allowedFormats,
            isPending: true
        };
        setPendingClients(prev => [tempClient, ...prev]);
        setIsLoading(true);

        // 2. Clear Form Immediately
        setName("");
        setEmail("");
        setPassword("");
        setCustomRates({
            "Short Videos": 500,
            "Long Videos": 1000,
            "Reels": 500,
            "Graphics Videos": 1500,
            "Ads/UGC Videos": 2000
        });
        setAllowedFormats({
            "Short Videos": false,
            "Long Videos": false,
            "Reels": false,
            "Graphics Videos": false,
            "Ads/UGC Videos": false
        });

        try {
            const res = await fetch('/api/sales/create-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: backup.email,
                    password: backup.password,
                    displayName: backup.name,
                    createdBy: user?.uid,
                    customRates: backup.customRates, 
                    allowedFormats: backup.allowedFormats
                })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to create client");

            toast.success(`Client "${backup.name}" created successfully!`);
            
            // Note: We DO NOT remove the pending client here. 
            // We wait for the Firestore onSnapshot to receive the real data.
            // The cleanup is handled in the useEffect below.

        } catch (error: any) {
            // Only log unexpected errors
            if (!error.message.includes("already registered")) {
                console.error(error);
            }
            toast.error(error.message);
            
            // Revert changes on error
            setPendingClients(prev => prev.filter(c => c.id !== tempId));
            setName(backup.name);
            setEmail(backup.email);
            setPassword(backup.password);
            setCustomRates(backup.customRates);
            setAllowedFormats(backup.allowedFormats);
            
        } finally {
            setIsLoading(false);
        }
    };

    // Cleanup Pending Clients when Real Data Arrives
    useEffect(() => {
        if (myClients.length > 0 && pendingClients.length > 0) {
             const existingEmails = new Set(myClients.map(c => c.email));
             setPendingClients(prev => {
                const filtered = prev.filter(p => !existingEmails.has(p.email));
                // Only update if changes found to prevent rerenders
                return filtered.length !== prev.length ? filtered : prev;
             });
        }
    }, [myClients, pendingClients.length]);

    return (
        <div className="flex min-h-screen bg-black text-white">
            {/* Sidebar (Simplified) */}
            <div className="w-64 border-r border-white/10 p-6 flex flex-col hidden md:flex">
                <div className="flex items-center gap-2 mb-10">
                    <span className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                        Sales Portal
                    </span>
                </div>

                <div className="space-y-2 flex-1">
                    <Button variant="ghost" className="w-full justify-start gap-2 bg-green-500/10 text-green-400">
                        <UserPlus className="w-4 h-4" />
                        Create Client
                    </Button>
                </div>

                <div className="mt-auto border-t border-white/10 pt-4">
                     <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-bold">
                            {user?.displayName?.[0]}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.displayName}</p>
                            <p className="text-xs text-zinc-500 truncate">Sales Executive</p>
                        </div>
                     </div>
                    <Button variant="ghost" className="w-full justify-start gap-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10" onClick={logout}>
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Client Management</h1>
                        <p className="text-zinc-400">Create accounts and share credentials.</p>
                    </div>
                    {/* Mobile Logout */}
                     <Button variant="ghost" size="icon" className="md:hidden text-zinc-400" onClick={logout}>
                        <LogOut className="w-5 h-5" />
                    </Button>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: Create Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden sticky top-8">
                            <div className="p-6 border-b border-white/10 bg-zinc-900/50">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-green-500" />
                                    New Client
                                </h3>
                            </div>
                            <div className="p-6">
                                <form onSubmit={handleCreateClient} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-300">Client Name</Label>
                                        <Input 
                                            placeholder="Company or Contact Name" 
                                            className="bg-black/40 border-white/10 text-white"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-zinc-300">Email (Login ID)</Label>
                                        <Input 
                                            type="email"
                                            placeholder="client@company.com" 
                                            className="bg-black/40 border-white/10 text-white"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-zinc-300">Password</Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                type="text" 
                                                placeholder="Secure Password" 
                                                className="bg-black/40 border-white/10 text-white font-mono"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                required
                                                minLength={6}
                                            />
                                            <Button type="button" variant="outline" size="icon" onClick={generatePassword} className="shrink-0 border-white/10 hover:bg-white/5">
                                                <RefreshCw className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-zinc-500">Auto-generate or type manually.</p>
                                    </div>

                                    {/* Custom Rates Section */}
                                    <div className="space-y-3 pt-4 border-t border-white/10">
                                        <Label className="text-zinc-300 flex items-center gap-2">
                                            <Shield className="w-3 h-3 text-emerald-500" /> 
                                            Custom Video Rates (INR)
                                        </Label>
                                        <div className="grid gap-2">
                                            {VIDEO_TYPES_LABELS.map((type) => (
                                                <div key={type} className={cn("flex items-center justify-between text-sm bg-black/20 p-2 rounded border transition-all", allowedFormats[type] ? "border-green-500/20 bg-green-500/5" : "border-white/5 opacity-60")}>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={allowedFormats[type]} 
                                                            onChange={(e) => setAllowedFormats({...allowedFormats, [type]: e.target.checked})}
                                                            className="w-4 h-4 rounded border-zinc-600 bg-black/40 text-green-500 focus:ring-green-500 focus:ring-offset-0"
                                                        />
                                                        <span className={cn("text-xs transition-colors", allowedFormats[type] ? "text-zinc-200" : "text-zinc-500")}>{type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-zinc-500 text-sm">₹</span>
                                                        <Input 
                                                            type="text" 
                                                            disabled={!allowedFormats[type]}
                                                            className="h-9 w-24 bg-black/40 border-white/10 text-white font-mono disabled:opacity-50" 
                                                            placeholder="0"
                                                            value={customRates[type]} 
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                                setCustomRates({...customRates, [type]: val ? parseInt(val) : 0});
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Button 
                                        type="submit" 
                                        className="w-full bg-green-600 hover:bg-green-700 text-white mt-4 h-11 font-medium"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                                            </>
                                        ) : (
                                            "Create Account"
                                        )}
                                    </Button>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Client List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden min-h-[500px] flex flex-col">
                             <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
                                <h3 className="text-lg font-semibold text-white">Your Clients</h3>
                                <div className="text-xs text-zinc-500 bg-white/5 px-2 py-1 rounded-full">
                                    Total: {displayedClients.length}
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-xs uppercase bg-white/5 text-zinc-400 font-medium">
                                        <tr>
                                            <th className="px-6 py-4 w-1/3">Client Name</th>
                                            <th className="px-6 py-4 w-1/3">Login ID</th>
                                            <th className="px-6 py-4 w-1/3">Password</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {displayedClients.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-12 text-center text-zinc-500">
                                                    No clients created yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedClients.map((client) => (
                                                <tr key={client.id} className={cn("transition-colors group", client.isPending ? "bg-green-500/5 animate-pulse" : "hover:bg-white/5")}>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs ring-1 ring-white/10">
                                                                {client.displayName?.[0]}
                                                            </div>
                                                            <span className="font-medium text-white">{client.displayName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded border border-white/5 w-fit group-hover:border-white/10 transition-colors">
                                                            <span className="font-mono text-sm text-zinc-300">{client.email}</span>
                                                            <Copy className="w-3.5 h-3.5 cursor-pointer text-zinc-500 hover:text-white transition-colors" onClick={() => { navigator.clipboard.writeText(client.email); toast.success("Email copied"); }} />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {client.initialPassword ? (
                                                            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded border border-white/5 w-fit group-hover:border-white/10 transition-colors">
                                                                <span className="font-mono text-sm text-emerald-400">{client.initialPassword}</span>
                                                                <Copy className="w-3.5 h-3.5 cursor-pointer text-zinc-500 hover:text-white transition-colors" onClick={() => { navigator.clipboard.writeText(client.initialPassword); toast.success("Password copied"); }} />
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-600 text-xs italic">Not visible</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
