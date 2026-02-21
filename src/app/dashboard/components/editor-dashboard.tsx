"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Project } from "@/types/schema";
import { cn } from "@/lib/utils";
import { 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Search, 
    Filter, 
    Zap,
    DollarSign,
    ArrowUpRight,
    ArrowDownLeft,
    MoreHorizontal,
    FileText,
    Upload,
    Eye,
    Briefcase,
    Calendar,
    RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel 
} from "@/components/ui/dropdown-menu";

export function EditorDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'todo' | 'review' | 'completed'>('all');
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

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const projectsRef = collection(db, "projects");
    const q = query(
        projectsRef, 
        where("assignedEditorId", "==", user.uid),
        orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProjects: Project[] = [];
        snapshot.forEach((doc) => {
            fetchedProjects.push({ id: doc.id, ...doc.data() } as Project);
        });
        setProjects(fetchedProjects);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching projects real-time:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, refreshKey]);

  // Derived State
  const todoProjects = projects.filter(p => p.status === 'active' || (p.status === 'pending_assignment' && p.assignedEditorId === user?.uid));
  const reviewProjects = projects.filter(p => p.status === 'in_review');
  const completedProjects = projects.filter(p => ['completed', 'approved'].includes(p.status));
  const totalEarnings = projects.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);

  const filteredProjects = projects.filter(project => {
      if (activeTab === 'todo' && !['active', 'pending_assignment'].includes(project.status)) return false;
      if (activeTab === 'review' && project.status !== 'in_review') return false;
      if (activeTab === 'completed' && !['completed', 'approved'].includes(project.status)) return false;
      if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase()) && !project.id.includes(searchQuery)) return false;
      return true;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-6 md:p-8 bg-background min-h-screen">
       {/* 1. Corporate Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-border">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Editor Workspace</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span>{user?.displayName || 'Editor'}</span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span>ID: {user?.uid?.slice(0,8)}</span>
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
                 <Button variant="outline" size="sm" className="h-9 font-medium border-border shadow-sm bg-background hover:bg-muted text-muted-foreground">
                    <FileText className="mr-2 h-4 w-4" /> View Guidelines
                </Button>
            </div>
       </div>

       {/* 2. KPIs */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard 
                label="Active Tasks" 
                value={todoProjects.length} 
                subtext="Action required"
                trend="High Priority"
                alert={todoProjects.length > 0}
            />
            <MetricCard 
                label="In Review" 
                value={reviewProjects.length} 
                subtext="Waiting for approval"
            />
            <MetricCard 
                label="Completed" 
                value={completedProjects.length} 
                subtext="Lifetime projects"
                trend="+5 this month"
                trendUp={true}
            />
             <MetricCard 
                label="Earnings" 
                value={`$${totalEarnings.toLocaleString()}`} 
                subtext="Total accrued"
            />
       </div>

       {/* 3. Task Table */}
       <div className="rounded-lg border border-border bg-card shadow-sm flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input 
                            placeholder="Search tasks by ID or Name..." 
                            className="pl-9 h-9 text-sm bg-background border-border shadow-none focus-visible:ring-1 focus-visible:ring-primary transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-background border border-border rounded-md p-0.5">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'todo', label: 'To Do' },
                            { id: 'review', label: 'In Review' },
                            { id: 'completed', label: 'Done' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-sm transition-all",
                                    activeTab === tab.id ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 500); }}>
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                        <tr>
                            <th className="px-6 py-3 w-[300px]">Project</th>
                            <th className="px-6 py-3 w-[150px]">Status</th>
                            <th className="px-6 py-3 w-[150px]">Client</th>
                            <th className="px-6 py-3 w-[150px]">Deadline</th>
                            <th className="px-6 py-3 w-[120px] text-right">Value</th>
                            <th className="px-6 py-3 w-[80px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                         {loading ? (
                            <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">Loading...</td></tr>
                        ) : filteredProjects.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <CheckCircle2 className="h-8 w-8 opacity-20" />
                                        <p className="font-medium text-foreground">No tasks found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredProjects.map((project) => {
                                // @ts-ignore
                                const deadline = project.deadline ? new Date(project.deadline) : null;
                                const isUrgent = deadline ? (deadline.getTime() - Date.now() < 172800000) : false; // < 48h

                                return (
                                    <tr key={project.id} className="group hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <Link href={`/dashboard/projects/${project.id}`} className="font-semibold text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-2 cursor-pointer">
                                                    {project.name}
                                                </Link>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border">ID: {project.id.slice(0,6)}</span>
                                                    {isUrgent && project.status !== 'completed' && (
                                                        <span className="text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900 flex items-center gap-1 font-medium">
                                                            <Clock className="w-3 h-3" /> Urgent
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <StatusBadge status={project.status} />
                                        </td>
                                        <td className="px-6 py-4 align-middle text-muted-foreground">
                                            {project.clientName}
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="flex flex-col text-xs">
                                                <span className={cn("font-medium", isUrgent ? "text-red-600" : "text-foreground")}>
                                                    {deadline ? deadline.toLocaleDateString() : "No Deadline"}
                                                </span>
                                                <span className="text-muted-foreground text-[10px]">Target Date</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle text-right font-mono text-sm text-foreground font-medium">
                                            ${project.totalCost?.toLocaleString() || "0.00"}
                                        </td>
                                        <td className="px-6 py-4 align-middle text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/projects/${project.id}`} className="cursor-pointer">
                                                            <Eye className="mr-2 h-4 w-4" /> View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {(project.status === 'active' || project.status === 'in_review') && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/dashboard/projects/${project.id}/upload`} className="cursor-pointer">
                                                                <Upload className="mr-2 h-4 w-4" /> Upload Draft
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
             <div className="border-t border-border p-4 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>Showing {filteredProjects.length} records</span>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled>Previous</Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled>Next</Button>
                </div>
            </div>
       </div>
    </div>
  );
}

// Sub-components used in ClientDashboard (Shared)
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
        active: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800" },
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
