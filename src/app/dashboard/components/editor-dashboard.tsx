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
    Search, 
    Filter, 
    List,
    FileVideo,
    User as UserIcon,
    Loader2,
    Briefcase,
    Zap,
    DollarSign,
    ArrowUpRight,
    Calendar,
    Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EditorDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'todo' | 'review' | 'completed'>('all');
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
  const todoProjects = projects.filter(p => p.status === 'active' || (p.status === 'pending_assignment' && p.assignedEditorId === user?.uid)); // Include pending assignment as todo if assigned
  const reviewProjects = projects.filter(p => p.status === 'in_review');
  const completedProjects = projects.filter(p => ['completed', 'approved'].includes(p.status));
  const totalEarnings = projects.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0); // Or totalCost if simpler

  const filteredProjects = projects.filter(project => {
      if (activeTab === 'todo' && !['active', 'pending_assignment'].includes(project.status)) return false;
      if (activeTab === 'review' && project.status !== 'in_review') return false;
      if (activeTab === 'completed' && !['completed', 'approved'].includes(project.status)) return false;
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
                Editor Workspace
            </h1>
            <p className="text-muted-foreground mt-2 text-sm max-w-md">
                Manage your tasks, track deadlines, and deliver high-quality edits.
            </p>
         </div>
       </div>

       {/* 2. Stats Overview */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard 
                label="Active Tasks" 
                value={todoProjects.length} 
                icon={Zap} 
                trend="Due soon"
                color="text-blue-500"
            />
            <StatsCard 
                label="In Review" 
                value={reviewProjects.length} 
                icon={AlertCircle} 
                trend="Awaiting feedback"
                color="text-purple-500"
            />
            <StatsCard 
                label="Completed" 
                value={completedProjects.length} 
                icon={CheckCircle2} 
                trend="Lifetime"
                color="text-emerald-500"
            />
             <StatsCard 
                label="Est. Earnings" 
                value={`$${totalEarnings.toLocaleString()}`} 
                icon={DollarSign} 
                trend="Total accrued"
                color="text-amber-500"
            />
       </div>

       {/* 3. Filters & Tabs */}
       <div className="flex flex-col gap-6 pt-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card p-2 rounded-2xl border border-border">
                <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-1">
                    {[
                        { id: 'all', label: 'All Tasks', count: projects.length },
                        { id: 'todo', label: 'To Do', count: todoProjects.length },
                        { id: 'review', label: 'In Review', count: reviewProjects.length },
                        { id: 'completed', label: 'Done', count: completedProjects.length },
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

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search tasks..." 
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
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
               </div>
               <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
               <p className="text-muted-foreground text-sm mt-1">No tasks found matching your filters.</p>
           </div>
       ) : (
           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
             <AnimatePresence mode="popLayout">
                {filteredProjects.map((project) => (
                   <TaskCard key={project.id} project={project} />
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
                         {/* Trend Logic simulated */}
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <p className="text-xs text-muted-foreground font-medium">{trend}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TaskCard({ project }: { project: Project }) {
    const statusConfig: Record<string, { label: string; color: string; progress: number }> = {
        active: { label: "In Progress", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", progress: 25 },
        in_review: { label: "Reviewing", color: "text-purple-500 bg-purple-500/10 border-purple-500/20", progress: 90 },
        pending_assignment: { label: "Unassigned", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", progress: 0 },
        approved: { label: "Approved", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", progress: 100 },
        completed: { label: "Done", color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20", progress: 100 },
    };

    const status = statusConfig[project.status] || { label: project.status, color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20", progress: 0 };
    
    // Deadline Calc
    // @ts-ignore
    const deadlineDate = project.deadline ? new Date(project.deadline) : null;
    const isUrgent = deadlineDate ? (deadlineDate.getTime() - Date.now() < 172800000) : false; // < 48h

    return (
        <Link href={`/dashboard/projects/${project.id}`}>
            <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group h-[280px] rounded-3xl bg-card border border-border p-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
                 <div className="flex flex-col h-full bg-muted/30 rounded-[20px] p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className={cn(
                            "px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider border", 
                            status.color
                        )}>
                            {status.label}
                        </div>
                        {isUrgent && project.status !== 'completed' && (
                            <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-1 rounded-full animate-pulse">
                                <Clock className="h-3 w-3" /> Urgent
                            </span>
                        )}
                    </div>

                    <h3 className="font-bold text-foreground text-lg leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                        {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 font-medium line-clamp-1">
                        Client: {project.clientName}
                    </p>

                    <div className="mt-auto space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Deadline</span>
                                <span className={cn("font-medium", isUrgent ? "text-red-400" : "text-foreground")}>
                                    {deadlineDate ? deadlineDate.toLocaleDateString() : "No Date"}
                                </span>
                            </div>
                             <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Value</span>
                                <span className="text-foreground font-medium">${project.totalCost || "0"}</span>
                            </div>
                        </div>

                         {/* Action Button for Active Projects */}
                         {(project.status === 'active' || project.status === 'in_review') && (
                            <Link href={`/dashboard/projects/${project.id}/upload`} className="block mt-4">
                                <Button className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-10 rounded-xl font-semibold">
                                     <Upload className="h-4 w-4 mr-2" />
                                     Submit Draft
                                </Button>
                            </Link>
                         )}

                        <div className="pt-4 border-t border-border flex items-center justify-between">
                            <div className="flex -space-x-2">
                                {/* Simulated Avatars */}
                                <div className="h-6 w-6 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] text-muted-foreground">CL</div>
                                <div className="h-6 w-6 rounded-full bg-primary border border-background flex items-center justify-center text-[8px] text-white">ME</div>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">ID: {project.id.slice(0,4)}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}

