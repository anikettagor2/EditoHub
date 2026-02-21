"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Loader2, 
    UserPlus, 
    Mail, 
    Lock, 
    User, 
    LogOut, 
    RefreshCw, 
    Copy, 
    ExternalLink, 
    Shield,
    Search,
    Filter,
    CheckCircle2,
    Clock,
    MoreHorizontal,
    ArrowUpRight,
    ArrowDownLeft,
    AlertCircle,
    Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase/config";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export function SalesDashboard() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [myClients, setMyClients] = useState<any[]>([]);
    
    // Form State
    const [isCreateOpen, setIsCreateOpen] = useState(false); // Toggle for form
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
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
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const handleRefresh = () => {
        setIsRefreshing(true);
        setRefreshKey(k => k + 1);
        setTimeout(() => {
            setIsRefreshing(false);
            setLastUpdated(new Date());
        }, 1000);
    };

    const VIDEO_TYPES_LABELS = [
        "Short Videos", "Long Videos", "Reels", "Graphics Videos", "Ads/UGC Videos"
    ];

    // Fetch Clients
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
        });

        return () => unsubscribe();
    }, [user, refreshKey]);

    // Merge & Filter
    const displayedClients = [...myClients, ...pendingClients]
        .filter((client, index, self) => 
            index === self.findIndex(t => t.email === client.email)
        )
        .filter(c => !searchQuery || c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase()))
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
        
        const backup = { name, email, password, customRates, allowedFormats };
        const tempId = `temp-${Date.now()}`;

        const tempClient = {
            id: tempId,
            displayName: name,
            email: email,
            phoneNumber: phone,
            initialPassword: password,
            createdAt: Date.now(),
            role: 'client',
            customRates,
            allowedFormats,
            isPending: true
        };
        setPendingClients(prev => [tempClient, ...prev]);
        setIsLoading(true);

        // Reset Form
        setName("");
        setEmail("");
        setPassword("");
        setPhone("");
        
        try {
            const res = await fetch('/api/sales/create-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: backup.email,
                    password: backup.password,
                    displayName: backup.name,
                    phoneNumber: phone, 
                    createdBy: user?.uid,
                    customRates: backup.customRates, 
                    allowedFormats: backup.allowedFormats
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create client");

            toast.success(`Client "${backup.name}" created successfully!`);
            setIsCreateOpen(false); // Close form on success

        } catch (error: any) {
            if (!error.message.includes("already registered")) {
                console.error(error);
            }
            toast.error(error.message);
            setPendingClients(prev => prev.filter(c => c.id !== tempId));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto p-6 md:p-8 bg-background min-h-screen">
            {/* 1. Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-border">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Sales Portal</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>{user?.displayName || 'Sales Executive'}</span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>Client Management</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all disabled:opacity-50 shadow-sm"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : `Updated ${lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}</span>
                    </button>
                     <Button 
                        onClick={() => setIsCreateOpen(!isCreateOpen)} 
                        className={cn("h-9 font-medium shadow-sm transition-all", isCreateOpen ? "bg-muted text-foreground hover:bg-muted/80" : "bg-primary text-primary-foreground hover:bg-primary/90")}
                    >
                        {isCreateOpen ? "Cancel Creation" : <><UserPlus className="mr-2 h-4 w-4" /> Add New Client</>}
                    </Button>
                </div>
            </div>

            {/* 2. KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <MetricCard 
                    label="Total Clients" 
                    value={myClients.length} 
                    subtext="Managed accounts"
                    trend="+1 this week"
                    trendUp={true}
                />
                 <MetricCard 
                    label="Pending Setup" 
                    value={pendingClients.length} 
                    subtext="Processing creation"
                    alert={pendingClients.length > 0}
                />
                 <MetricCard 
                    label="Active Revenue" 
                    value="$0.00" 
                    subtext="Total client value"
                />
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
                 {/* 3. Create Client Form (Conditional or Side Panel) */}
                 {isCreateOpen && (
                     <div className="lg:col-span-1 bg-card border border-border rounded-lg shadow-sm overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300">
                         <div className="p-4 border-b border-border bg-muted/30">
                             <h3 className="font-semibold text-foreground flex items-center gap-2">
                                 <UserPlus className="h-4 w-4 text-primary" /> New Client Details
                             </h3>
                         </div>
                         <div className="p-6 space-y-4">
                            <form onSubmit={handleCreateClient} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Client Name</Label>
                                    <Input placeholder="Company or Contact Name" value={name} onChange={e => setName(e.target.value)} required className="bg-background" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email (Login ID)</Label>
                                    <Input type="email" placeholder="client@company.com" value={email} onChange={e => setEmail(e.target.value)} required className="bg-background" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number (10 Digits)</Label>
                                    <div className="flex gap-2">
                                        <div className="flex items-center justify-center px-3 bg-muted border border-border rounded-lg text-xs font-bold text-muted-foreground">+91</div>
                                        <Input 
                                            type="tel" 
                                            placeholder="9876543210" 
                                            value={phone} 
                                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                                            required 
                                            pattern="[0-9]{10}"
                                            className="bg-background" 
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Required for WhatsApp status notifications</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <div className="flex gap-2">
                                        <Input type="text" placeholder="Secure Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="bg-background font-mono" />
                                        <Button type="button" variant="outline" size="icon" onClick={generatePassword} className="shrink-0"><RefreshCw className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-border">
                                    <Label className="mb-3 block text-xs uppercase text-muted-foreground font-bold tracking-wider">Custom Rates</Label>
                                    <div className="space-y-2">
                                        {VIDEO_TYPES_LABELS.map((type) => (
                                            <div key={type} className={cn("flex items-center justify-between text-sm p-2 rounded border transition-all", allowedFormats[type] ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border opacity-60")}>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={allowedFormats[type]} 
                                                        onChange={(e) => setAllowedFormats({...allowedFormats, [type]: e.target.checked})}
                                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                                    />
                                                    <span className="text-xs font-medium">{type}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground">₹</span>
                                                    <Input 
                                                        disabled={!allowedFormats[type]}
                                                        className="h-7 w-20 text-xs font-mono bg-background" 
                                                        value={customRates[type]} 
                                                        onChange={(e) => setCustomRates({...customRates, [type]: parseInt(e.target.value) || 0})}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Client Account"}
                                </Button>
                            </form>
                         </div>
                     </div>
                 )}

                 {/* 4. Client List Table */}
                 <div className={cn("bg-card border border-border rounded-lg shadow-sm flex flex-col", isCreateOpen ? "lg:col-span-2" : "lg:col-span-3")}>
                      <div className="p-4 border-b border-border flex justify-between bg-muted/30">
                        <div className="relative w-72">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                             <Input 
                                placeholder="Search clients..." 
                                className="pl-9 h-9 bg-background" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="ghost" size="sm" className="h-9"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
                      </div>

                      <div className="overflow-x-auto">
                           <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                                    <tr>
                                        <th className="px-6 py-3">Client Name</th>
                                        <th className="px-6 py-3">Login ID</th>
                                        <th className="px-6 py-3">Initial Password</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {displayedClients.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">No clients found. Add one to get started.</td></tr>
                                    ) : (
                                        displayedClients.map((client) => (
                                            <tr key={client.id} className={cn("hover:bg-muted/50 transition-colors", client.isPending && "bg-amber-50/50 dark:bg-amber-900/10")}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                                                            {client.displayName?.[0]}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-foreground">{client.displayName}</div>
                                                            {client.isPending && <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Creating...</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                     <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { navigator.clipboard.writeText(client.email); toast.success("Copied"); }}>
                                                        <span className="font-mono text-muted-foreground group-hover:text-foreground transition-colors">{client.email}</span>
                                                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                     </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {client.initialPassword ? (
                                                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { navigator.clipboard.writeText(client.initialPassword); toast.success("Copied"); }}>
                                                            <span className="font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">{client.initialPassword}</span>
                                                            <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic text-xs">Hidden</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem><Mail className="mr-2 h-4 w-4" /> Send Email</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-600"><LogOut className="mr-2 h-4 w-4" /> Deactivate</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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
    );
}

// Consistent Metric Card
function MetricCard({ label, value, subtext, trend, trendUp, alert }: any) {
    return (
        <div className={cn(
            "bg-card border border-border rounded-lg p-5 flex flex-col justify-between shadow-sm transition-all hover:border-muted-foreground/30",
            alert && "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10"
        )}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                {alert && <AlertCircle className="h-4 w-4 text-amber-500" />}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
                 {trend && (
                    <span className={cn("text-xs font-medium flex items-center gap-0.5", trendUp ? "text-emerald-600" : "text-muted-foreground")}>
                        {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        {trend}
                    </span>
                 )}
                 <span className="text-xs text-muted-foreground">{subtext}</span>
            </div>
        </div>
    );
}
