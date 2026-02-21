"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { 
    Loader2, 
    LayoutDashboard, 
    Users, 
    FolderOpen, 
    LogOut,
    Search,
    Filter,
    MoreHorizontal,
    ArrowUpRight,
    ArrowDownLeft,
    AlertCircle,
    UserPlus,
    CheckCircle2,
    Calendar,
    Briefcase,
    RefreshCw
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { collection, query, orderBy, onSnapshot, updateDoc, doc, arrayUnion } from "firebase/firestore";
import { Project, User } from "@/types/schema";
import { assignEditor, togglePayLater } from "@/app/actions/admin-actions";
import { unlockProjectDownloads } from "@/app/actions/project-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function ProjectManagerDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'projects' | 'clients'>('projects');
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [editors, setEditors] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    
    // Assignment Modal State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setRefreshKey(k => k + 1);
        setTimeout(() => {
            setIsRefreshing(false);
            setLastUpdated(new Date());
        }, 1000);
    };

    useEffect(() => {
        setLoading(true);
        // 1. Fetch Projects
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const unsubProjects = onSnapshot(q, (snapshot) => {
            setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
        });

        // 2. Fetch Users (Editors & Clients)
        const usersQ = collection(db, "users");
        const unsubUsers = onSnapshot(usersQ, (snapshot) => {
             const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
             setUsers(allUsers);
             setEditors(allUsers.filter((u) => u.role === 'editor'));
             setLoading(false);
        });

        return () => {
            unsubProjects();
            unsubUsers();
        };
    }, [refreshKey]);

    const handleAssignEditor = async (editorId: string) => {
        if (!selectedProject) return;
        try {
            const res = await assignEditor(selectedProject.id, editorId);
            if (res.success) {
                toast.success(`Project assigned & notification sent!`);
                setIsAssignModalOpen(false);
                setSelectedProject(null);
            } else {
                toast.error(res.error || "Failed to assign project");
            }
        } catch (err) { 
            console.error(err);
            toast.error("An error occurred"); 
        }
    };

    const unassignedCount = projects.filter(p => !p.assignedEditorId).length;
    const activeCount = projects.filter(p => p.status === 'active').length;
    const pendingUnlockCount = projects.filter(p => p.downloadUnlockRequested && p.paymentStatus !== 'full_paid').length;

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto p-6 md:p-8 bg-background min-h-screen">
            {/* 1. Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-border">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Project Management</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>{user?.displayName || 'Manager'}</span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>Workflow Control</span>
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
                    <div className="flex bg-muted p-1 border border-border rounded-lg">
                        {['projects', 'clients'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-semibold rounded-md capitalize transition-all",
                                    activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <MetricCard 
                    label="Unassigned" 
                    value={unassignedCount} 
                    subtext="Requires allocation"
                    trend="Needs Action"
                    alert={unassignedCount > 0}
                />
                 <MetricCard 
                    label="In Production" 
                    value={activeCount} 
                    subtext="Currently editing"
                    trend="Stable"
                    trendUp={true}
                />
                 <MetricCard 
                    label="Available Editors" 
                    value={editors.length} 
                    subtext="Team capacity"
                />
                 <MetricCard 
                    label="Unlock Requests" 
                    value={pendingUnlockCount} 
                    subtext="Awaiting approval"
                    trend={pendingUnlockCount > 0 ? "Action Required" : undefined}
                    alert={pendingUnlockCount > 0}
                />
            </div>

            {/* 3. Main Content Area */}
            <div className="rounded-lg border border-border bg-card shadow-sm flex flex-col min-h-[600px]">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30">
                     <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-72">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Input 
                                placeholder="Search by Project or Client..." 
                                className="pl-9 h-9 text-sm bg-background border-border shadow-none focus-visible:ring-1 focus-visible:ring-primary transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="sm" className="h-9 border-dashed border-border"><Filter className="mr-2 h-3.5 w-3.5" /> Filter</Button>
                     </div>
                </div>

                <div className="overflow-x-auto">
                    {activeTab === 'projects' && (
                     <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                            <tr>
                                <th className="px-6 py-3">Project / Client</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Assigned Team</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={4} className="px-6 py-16 text-center text-muted-foreground"><Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />Loading workspace...</td></tr>
                            ) : projects.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-16 text-center text-muted-foreground">No projects found.</td></tr>
                            ) : (
                                projects.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.clientName?.toLowerCase().includes(searchQuery.toLowerCase())).map((project) => {
                                    const assignedEditor = editors.find(e => e.uid === project.assignedEditorId);
                                    
                                    return (
                                    <tr key={project.id} className="group hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="font-semibold text-foreground flex items-center gap-2">{project.name}</div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Briefcase className="w-3 h-3" />
                                                    <span>{project.clientName || 'Unknown Client'}</span>
                                                    <span>•</span>
                                                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border">ID: {project.id.slice(0,6)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <StatusBadge status={project.status} />
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            {assignedEditor ? (
                                                <div className="flex items-center gap-2 bg-background border border-border px-2 py-1.5 rounded-md w-fit">
                                                    <Avatar className="h-6 w-6 border border-border">
                                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{assignedEditor.displayName?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                         <span className="text-xs font-medium text-foreground leading-none">{assignedEditor.displayName}</span>
                                                         <span className="text-[10px] text-muted-foreground leading-none">Editor</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded-md border border-amber-200 dark:border-amber-800 w-fit">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-bold uppercase tracking-wide">Unassigned</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 align-middle text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Unlock Request Badge + Approve Action */}
                                                {project.downloadUnlockRequested && project.paymentStatus !== 'full_paid' && (
                                                    <Button
                                                        size="sm"
                                                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3"
                                                        onClick={async () => {
                                                            if (!user) return;
                                                            const res = await unlockProjectDownloads(project.id, user.uid);
                                                            if (res.success) {
                                                                toast.success(`Downloads unlocked for ${project.name}`);
                                                                setProjects(prev => prev.map(p => p.id === project.id ? { ...p, paymentStatus: 'full_paid', status: 'completed', downloadsUnlocked: true, downloadUnlockRequested: false } as any : p));
                                                            } else {
                                                                toast.error(res.error || "Failed to unlock");
                                                            }
                                                        }}
                                                    >
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Approve Unlock
                                                    </Button>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground group-hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => { setSelectedProject(project); setIsAssignModalOpen(true); }}>
                                                            <UserPlus className="mr-2 h-4 w-4" /> {project.assignedEditorId ? 'Reassign' : 'Assign Editor'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem><FolderOpen className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </td>
                                    </tr>
                                )})
                            )}
                        </tbody>
                     </table>
                    )}

                    {activeTab === 'clients' && (
                        <div className="divide-y divide-border">
                             <div className="bg-muted/50 px-6 py-3 border-b border-border font-semibold text-xs text-muted-foreground uppercase flex items-center justify-between">
                                 <span>Client Name</span>
                                 <span>Payment Override</span>
                             </div>
                             {users.filter(u => u.role === 'client' && (!searchQuery || u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()))).map(u => (
                                 <div key={u.uid} className="px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                                     <div className="flex items-center gap-3">
                                         <Avatar className="h-8 w-8 border border-border">
                                             <AvatarFallback>{u.displayName?.[0]}</AvatarFallback>
                                         </Avatar>
                                         <div>
                                             <div className="font-medium text-sm text-foreground">{u.displayName}</div>
                                             <div className="text-xs text-muted-foreground">{u.email}</div>
                                             <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[150px] truncate" title={u.uid}>ID: {u.uid}</div>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <Button 
                                             variant={u.payLater ? "default" : "outline"} 
                                             size="sm" 
                                             className={cn("text-xs h-7", u.payLater && "bg-emerald-600 hover:bg-emerald-700")}
                                             onClick={async () => {
                                                 const res = await togglePayLater(u.uid, !u.payLater);
                                                 if(res.success) toast.success(`Pay Later ${!u.payLater ? 'enabled' : 'disabled'} for ${u.displayName}`);
                                                 else toast.error("Failed to update");
                                             }}
                                         >
                                             {u.payLater ? "Pay Later: ON" : "Pay Later: OFF"}
                                         </Button>
                                     </div>
                                 </div>
                             ))}
                             {users.filter(u => u.role === 'client').length === 0 && (
                                 <div className="px-6 py-8 text-center text-sm text-muted-foreground">No clients found.</div>
                             )}
                        </div>
                    )}
                </div>
            </div>

            {/* Assignment Modal */}
            <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign Editor">
                 <div className="pt-4 space-y-4 max-h-[400px] overflow-y-auto">
                     <div className="text-sm text-muted-foreground pb-2 border-b border-border">
                         Select a team member for <span className="font-semibold text-foreground">{selectedProject?.name}</span>
                     </div>
                     <div className="space-y-2">
                        {editors.length === 0 ? (
                             <p className="text-center py-8 text-sm text-muted-foreground">No editors found.</p>
                        ) : (
                             editors.map((editor) => {
                                 const activeCount = projects.filter(p => p.assignedEditorId === editor.uid && !['completed', 'approved'].includes(p.status)).length;
                                 const isFull = activeCount >= 5;
                                 const isCurrent = selectedProject?.assignedEditorId === editor.uid;

                                 return (
                                     <button
                                        key={editor.uid}
                                        disabled={isFull && !isCurrent}
                                        onClick={() => !isFull && handleAssignEditor(editor.uid)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                                            isCurrent ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:border-primary/50 hover:bg-accent",
                                            isFull && !isCurrent && "opacity-50 cursor-not-allowed bg-muted"
                                        )}
                                     >
                                         <div className="flex items-center gap-3">
                                             <Avatar className="h-9 w-9 border border-border">
                                                 <AvatarFallback className="bg-primary/10 text-primary">{editor.displayName?.[0]}</AvatarFallback>
                                             </Avatar>
                                             <div>
                                                 <div className="text-sm font-medium text-foreground">{editor.displayName}</div>
                                                 <div className="text-xs text-muted-foreground">{editor.email}</div>
                                             </div>
                                         </div>
                                         <div className="flex flex-col items-end gap-1">
                                             {isCurrent ? (
                                                 <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Assigned</span>
                                             ) : isFull ? (
                                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Full</span>
                                             ) : (
                                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-600 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Avaliable</span>
                                             )}
                                             <span className="text-[10px] text-muted-foreground">{activeCount} Active Tasks</span>
                                         </div>
                                     </button>
                                 )
                             })
                        )}
                     </div>
                 </div>
            </Modal>
        </div>
    );
}

// Sub-components
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

function StatusBadge({ status }: { status: string }) {
    const config: any = {
        active: { label: "In Production", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800" },
        in_review: { label: "Review Needed", className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800" },
        pending_assignment: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" },
        approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800" },
        completed: { label: "Completed", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
    };
    
    const style = config[status] || config.completed;

    return (
        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", style.className)}>
            {style.label}
        </span>
    );
}
