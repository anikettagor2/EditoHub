"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { Project } from "@/types/schema";
import { cn } from "@/lib/utils";
import { 
    Plus, 
    Search, 
    Filter,
    Calendar,
    Briefcase,
    DollarSign,
    MoreHorizontal,
    FileText,
    Download,
    Eye,
    ChevronDown,
    ArrowUpRight,
    ArrowDownLeft,
    CheckCircle2,
    AlertCircle,
    Clock,
    User as UserIcon,
    RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel 
} from "@/components/ui/dropdown-menu";

export function ClientDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    if (!user?.uid) return;
    setLoading(true);

    const q = query(
      collection(db, "projects"),
      where("clientId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, refreshKey]);

  // Derived State
  const filteredProjects = projects.filter(project => {
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase()) && !project.id.includes(searchQuery)) return false;
      return true;
  });

  const activeCount = projects.filter(p => ['active', 'in_review'].includes(p.status)).length;
  const pendingCount = projects.filter(p => p.status === 'pending_assignment').length;
  const totalSpent = projects.reduce((acc, curr) => acc + (curr.totalCost || 0), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-6 md:p-8 bg-background min-h-screen">
       {/* 1. Corporate Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-border">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Production Dashboard</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span>{user?.displayName || 'Client'}</span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span>Reference ID: {user?.uid?.slice(0,8)}</span>
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
                    <Download className="mr-2 h-4 w-4" /> Export Report
                </Button>
                <Link href="/dashboard/projects/new">
                    <Button size="sm" className="h-9 font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" /> New Request
                    </Button>
                </Link>
            </div>
       </div>

       {/* 2. Key Performance Indicators (KPIs) */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard 
                label="Active Requests" 
                value={activeCount} 
                subtext="In production pipeline"
                trend="+2 this week"
                trendUp={true}
            />
            <MetricCard 
                label="Total Spend (YTD)" 
                value={`$${totalSpent.toLocaleString()}`} 
                subtext="Budget utilization" 
                trend="12% vs last month"
                trendUp={true}
            />
            <MetricCard 
                label="Pending Review" 
                value={projects.filter(p => p.status === 'in_review').length} 
                subtext="Requires your action"
                alert={projects.filter(p => p.status === 'in_review').length > 0}
            />
             <MetricCard 
                label="Total Projects" 
                value={projects.length} 
                subtext="Lifetime requests"
            />
       </div>

       {/* 3. Data Table Section */}
       <div className="rounded-lg border border-border bg-card shadow-sm flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input 
                            placeholder="Search by ID, Name or Reference..." 
                            className="pl-9 h-9 text-sm bg-background border-border shadow-none focus-visible:ring-1 focus-visible:ring-primary transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 border-dashed border-border bg-background shadow-none font-normal text-muted-foreground hover:text-foreground">
                                <Filter className="mr-2 h-3.5 w-3.5" />
                                {statusFilter === 'all' ? 'Filter Status' : statusFilter.replace('_', ' ')}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[180px]">
                            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setStatusFilter('all')}>All Projects</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('active')}>In Progress</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('in_review')}>In Review</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('completed')}>Completed</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 500); }}>
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                        <tr>
                            <th className="px-6 py-3 w-[300px]">Project Details</th>
                            <th className="px-6 py-3 w-[150px]">Status</th>
                            <th className="px-6 py-3 w-[150px]">Assigned To</th>
                            <th className="px-6 py-3 w-[150px]">Timeline</th>
                            <th className="px-6 py-3 w-[120px] text-right">Value</th>
                            <th className="px-6 py-3 w-[80px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                                    Loading data...
                                </td>
                            </tr>
                        ) : filteredProjects.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Briefcase className="h-8 w-8 opacity-20" />
                                        <p className="font-medium text-foreground">No projects found</p>
                                        <p className="text-xs">Adjust your search or create a new request.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredProjects.map((project) => (
                                <tr key={project.id} className="group hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-1">
                                            <Link href={`/dashboard/projects/${project.id}`} className="font-semibold text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-2 cursor-pointer">
                                                {project.name}
                                            </Link>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border">ID: {project.id.slice(0,6)}</span>
                                                <span>•</span>
                                                <span className="capitalize">{project.videoType || 'Video'}</span>
                                                {project.isPayLaterRequest && (
                                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1 rounded uppercase font-bold tracking-tighter">Pay Later</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <StatusBadge status={project.status} />
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        {project.assignedEditorId ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold ring-1 ring-border">
                                                    ED
                                                </div>
                                                <span className="text-sm font-medium text-foreground">Assigned</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                                                <AlertCircle className="h-3.5 w-3.5" /> Unassigned
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <div className="flex flex-col text-xs">
                                            {/* @ts-ignore */}
                                            <span className="text-foreground font-medium">{project.deadline ? new Date(project.deadline).toLocaleDateString() : "No Deadline"}</span>
                                            {/* @ts-ignore */}
                                            <span className="text-muted-foreground">Created: {new Date(project.createdAt).toLocaleDateString()}</span>
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
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-muted-foreground" disabled>
                                                    <FileText className="mr-2 h-4 w-4" /> Download Invoice
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Footer Pagination (Placeholder) */}
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
