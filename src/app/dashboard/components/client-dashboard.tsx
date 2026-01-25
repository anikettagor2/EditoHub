"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import { Project } from "@/types/schema";
import { cn } from "@/lib/utils";
import { 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Plus, 
    Loader2, 
    Search, 
    Filter, 
    LayoutGrid, 
    List,
    MoreHorizontal,
    FileVideo,
    Calendar,
    User as UserIcon,
    ArrowUpRight,
    Briefcase,
    BarChart3,
    DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClientDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const projectsRef = collection(db, "projects");
    const q = query(
        projectsRef, 
        where("members", "array-contains", user.uid),
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
  }, [user]);

  // Derived State
  const activeProjects = projects.filter(p => ['active', 'in_review'].includes(p.status));
  const pendingProjects = projects.filter(p => ['pending_assignment'].includes(p.status));
  const completedProjects = projects.filter(p => ['completed', 'approved'].includes(p.status));
  const totalBudget = projects.reduce((acc, curr) => acc + (curr.totalCost || 0), 0);

  const filteredProjects = projects.filter(project => {
      // 1. Tab Filter
      if (activeTab === 'active' && !['active', 'in_review'].includes(project.status)) return false;
      if (activeTab === 'pending' && !['pending_assignment'].includes(project.status)) return false;
      if (activeTab === 'completed' && !['completed', 'approved'].includes(project.status)) return false;

      // 2. Search Filter
      if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      return true;
  });

  if (loading) {
     return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
     );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
       {/* 1. Header Section */}
       <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">
                Client Dashboard
            </h1>
            <p className="text-muted-foreground mt-2 text-sm max-w-md">
                Manage your video productions, review drafts, and track progress in real-time.
            </p>
         </div>
         <div className="flex gap-3">
             <Link href="/dashboard/projects/new">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/25 rounded-xl h-12 px-6 text-sm font-semibold">
                    <Plus className="h-4 w-4" />
                    New Project
                </Button>
             </Link>
         </div>
       </div>

       {/* 2. Stats Overview */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard 
                label="Total Projects" 
                value={projects.length} 
                icon={Briefcase} 
                trend="+2 this month"
                color="text-blue-500"
            />
            <StatsCard 
                label="Active Productions" 
                value={activeProjects.length} 
                icon={FileVideo} 
                trend="On track"
                color="text-primary"
            />
            <StatsCard 
                label="Action Required" 
                value={pendingProjects.length} 
                icon={AlertCircle} 
                trend="Pending review"
                color="text-amber-500"
            />
            <StatsCard 
                label="Total Budget" 
                value={`$${totalBudget.toLocaleString()}`} 
                icon={DollarSign} 
                trend="Lifetime spend"
                color="text-emerald-500"
            />
       </div>

       {/* 3. Filters & Tabs */}
       <div className="flex flex-col gap-6 pt-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card p-2 rounded-2xl border border-border">
                {/* Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-1">
                    {[
                        { id: 'all', label: 'All Projects', count: projects.length },
                        { id: 'active', label: 'Active', count: activeProjects.length },
                        { id: 'pending', label: 'Pending', count: pendingProjects.length },
                        { id: 'completed', label: 'Completed', count: completedProjects.length },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all whitespace-nowrap",
                                activeTab === tab.id 
                                    ? "bg-muted text-foreground shadow-sm font-bold" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={cn(
                                    "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                                    activeTab === tab.id ? "bg-foreground/10 text-foreground" : "bg-muted-foreground/10 text-muted-foreground"
                                )}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by name or ID..." 
                        className="pl-11 bg-muted/50 border-input focus:border-primary/50 h-11 rounded-xl text-foreground placeholder:text-muted-foreground transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
       </div>

       {/* 4. Project Grid */}
       {filteredProjects.length === 0 ? (
           <div className="py-32 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-muted/20">
               <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4 opacity-50">
                    <Search className="h-8 w-8 text-muted-foreground" />
               </div>
               <h3 className="text-lg font-semibold text-foreground">No projects found</h3>
               <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters or create a new project.</p>
           </div>
       ) : (
           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
             <AnimatePresence mode="popLayout">
                {filteredProjects.map((project) => (
                   <ProjectCard key={project.id} project={project} />
                ))}
             </AnimatePresence>
           </div>
       )}
    </div>
  );
}

function StatsCard({ label, value, icon: Icon, trend, color }: any) {
    return (
        <div className="p-6 rounded-3xl bg-card border border-border hover:border-primary/20 transition-all relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                <Icon className={cn("h-24 w-24", color)} />
            </div>
            <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl bg-muted/50 border border-border", color)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{label}</span>
                </div>
                <div>
                    <div className="text-3xl font-bold text-foreground tracking-tight font-heading">{value}</div>
                    <div className="flex items-center gap-1 mt-1">
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                        <p className="text-xs text-muted-foreground font-medium">{trend}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProjectCard({ project }: { project: Project }) {
    // Map status to Corporate UI properties
    const statusConfig: Record<string, { label: string; color: string; progress: number; icon: any }> = {
        active: { label: "In Production", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", progress: 45, icon: FileVideo },
        in_review: { label: "Needs Review", color: "text-purple-500 bg-purple-500/10 border-purple-500/20", progress: 90, icon: AlertCircle },
        pending_assignment: { label: "Finding Editor", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", progress: 10, icon: UserIcon },
        approved: { label: "Approved", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", progress: 100, icon: CheckCircle2 },
        completed: { label: "Completed", color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20", progress: 100, icon: CheckCircle2 },
    };
    
    const status = statusConfig[project.status] || { label: project.status, color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20", progress: 0, icon: FileVideo };
    const StatusIcon = status.icon;

    return (
        <Link href={`/dashboard/projects/${project.id}`}>
            <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group h-[320px] rounded-3xl bg-card border border-border p-1 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300"
            >
                <div className="flex flex-col h-full bg-muted/30 rounded-[20px] p-6 relative overflow-hidden">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                         <div className="space-y-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">ID: {project.id.slice(0,6)}</span>
                            <h3 className="font-bold text-foreground text-lg leading-tight line-clamp-2 pr-4 group-hover:text-primary transition-colors">{project.name}</h3>
                         </div>
                         <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0 border", status.color)}>
                             <StatusIcon className="h-5 w-5" />
                         </div>
                    </div>

                    {/* Meta Data Grid */}
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 my-auto">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                <UserIcon className="h-3 w-3" /> Editor
                            </p>
                            <p className="text-sm text-foreground font-semibold truncate">
                                {project.assignedEditorId ? "Assigned" : "Pending..."}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                <DollarSign className="h-3 w-3" /> Budget
                            </p>
                            <p className="text-sm text-foreground font-semibold">
                                ${project.totalCost || "0"}
                            </p>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" /> Deadline
                            </p>
                            {/* @ts-ignore */}
                            <p className="text-sm text-foreground font-medium truncate">
                                {project.deadline ? new Date(project.deadline).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "No deadline set"}
                            </p>
                        </div>
                    </div>

                    {/* Footer / Status */}
                    <div className="mt-auto space-y-3 pt-6 border-t border-border">
                        
                        {/* Client Action Button */}
                        {project.status === 'in_review' && (
                             <div className="mb-4">
                                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-9 rounded-xl font-semibold text-xs cursor-pointer">
                                     <div>Review Latest Draft</div>
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-xs">
                             <div className={cn("px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider border", status.color)}>
                                 {status.label}
                             </div>
                             <span className="font-mono text-muted-foreground">{status.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-white/20 relative overflow-hidden" 
                                style={{ width: `${status.progress}%` }}
                            >
                                <div className="absolute inset-0 bg-primary opacity-100" />
                            </div>
                        </div>
                    </div>

                </div>
            </motion.div>
        </Link>
    );
}
