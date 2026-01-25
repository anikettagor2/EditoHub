"use client";

import { useState, useEffect } from "react";
import { 
    collection, 
    query, 
    getDocs, 
    orderBy, 
    doc,
    updateDoc, 
    arrayUnion,
    onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Project, User } from "@/types/schema";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Users, 
    Briefcase, 
    Search, 
    Filter, 
    Trash2, 
    UserPlus, 
    AlertCircle, 
    DollarSign,
    RefreshCw,
    Edit,
    FileVideo,
    Clock,
    User as UserIcon,
    Loader2,
    ArrowUpRight,
    MoreHorizontal,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { deleteUser, deleteProject } from "@/app/actions/admin-actions";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'users'>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [editForm, setEditForm] = useState({
      totalCost: 0,
      status: ''
  });

  const [stats, setStats] = useState({
    revenue: 0,
    activeProjects: 0,
    pendingAssignment: 0,
    totalUsers: 0
  });

  useEffect(() => {
    setLoading(true);

    // 1. Projects Listener
    const projectsQ = query(collection(db, "projects"), orderBy("updatedAt", "desc"));
    const unsubProjects = onSnapshot(projectsQ, (snapshot) => {
        const fetchedProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(fetchedProjects);
        updateStats(fetchedProjects, users); // Trigger recalculation
    }, (error) => toast.error("Live projects update failed"));

    // 2. Users Listener
    const usersQ = collection(db, "users");
    const unsubUsers = onSnapshot(usersQ, (snapshot) => {
        const fetchedUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        setUsers(fetchedUsers);
        updateStats(projects, fetchedUsers); // Trigger recalculation
    }, (error) => toast.error("Live users update failed"));

    // Cleanup
    return () => {
        unsubProjects();
        unsubUsers();
    };
  }, []); // Run on mount

  // Helper to sync stats when either projects or users change
  // Note: We need this because closures might capture stale state if not careful, 
  // but since we update 'projects' and 'users' state, we can use a separate effect 
  // OR just calculate stats on the fly. 
  // BETTER APPROACH: Use a useEffect dependent on projects/users to update stats.

  useEffect(() => {
      if(projects.length > 0 || users.length > 0) {
          setLoading(false);
          setStats({
            revenue: projects.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0),
            activeProjects: projects.filter(p => !['completed', 'approved'].includes(p.status)).length,
            pendingAssignment: projects.filter(p => p.status === 'pending_assignment').length,
            totalUsers: users.length
        });
      }
  }, [projects, users]);

  // Removed async fetchData entirely as it's replaced by listeners
  function updateStats(currentProjects: Project[], currentUsers: User[]) {
      // Placeholder if strict syncing needed immediately inside callbacks,
      // but the useEffect [projects, users] handles it cleaner.
  }

  const handleDeleteProject = async (projectId: string) => {
    if(!confirm("Are you sure?")) return;
    // Listener will update state
    const result = await deleteProject(projectId);
    if (result.success) toast.success("Project deleted");
    else toast.error("Failed");
  };

  const handleDeleteUser = async (uid: string) => {
    if(!confirm("Are you sure you want to delete this user? ALL their data will be lost.")) return;
    
    // Listener will update state
    const result = await deleteUser(uid);
    if (result.success) {
        toast.success("User deleted successfully");
    } else {
        toast.error("Failed to delete user: " + result.error);
    }
  };

  const handleAssignEditor = async (editorId: string) => {
    if (!selectedProject) return;
    try {
        await updateDoc(doc(db, "projects", selectedProject.id), {
             assignedEditorId: editorId,
             status: 'active', 
             members: arrayUnion(editorId),
             updatedAt: Date.now()
        });
        toast.success("Editor assigned");
        setIsAssignModalOpen(false);
    } catch (err) { toast.error("Failed"); }
  };

  const handleUpdateProject = async () => {
      if (!selectedProject) return;
      try {
          await updateDoc(doc(db, "projects", selectedProject.id), {
              totalCost: Number(editForm.totalCost),
              status: editForm.status,
              updatedAt: Date.now()
          });
          toast.success("Updated");
          setIsEditModalOpen(false);
      } catch (err) { toast.error("Failed"); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground bg-background"><Loader2 className="animate-spin mr-2" /> Loading Admin Dashboard...</div>;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-20">
       {/* 1. Header & Stats Row */}
       <div className="flex flex-col gap-8">
         <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">Admin Overview</h1>
                <p className="text-muted-foreground text-sm mt-1">Global operations, financial tracking, and user management.</p>
            </div>
            <div className="flex bg-muted p-1.5 border border-border rounded-xl">
                 {['overview', 'projects', 'users'].map(tab => (
                     <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={cn(
                            "px-6 py-2.5 text-sm font-semibold rounded-lg capitalize transition-all",
                            activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                     >
                        {tab}
                     </button>
                 ))}
            </div>
         </div>

         {activeTab === 'overview' && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard label="Total Revenue" value={`₹${stats.revenue.toLocaleString()}`} icon={DollarSign} color="text-emerald-500" trend="+12.5%" />
                <StatsCard label="Active Projects" value={stats.activeProjects} icon={FileVideo} color="text-blue-500" trend="+4 new" />
                <StatsCard label="Pending Assignment" value={stats.pendingAssignment} icon={AlertCircle} color="text-amber-500" trend="Action needed" />
                <StatsCard label="Total Users" value={stats.totalUsers} icon={Users} color="text-purple-500" trend="Stable" />
            </div>
         )}
       </div>

       {/* 2. Content Sections */}
       <AnimatePresence mode="wait">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="grid gap-8 lg:grid-cols-2">
                    <RecentTable 
                        title="Recent Projects" 
                        headers={['Project', 'Status', 'Date']} 
                        data={projects.slice(0, 5)} 
                        type="project"
                    />
                     <RecentTable 
                        title="Needs Attention" 
                        headers={['Project', 'Client', 'Action']} 
                        data={projects.filter(p => p.status === 'pending_assignment')} 
                        type="pending"
                        onAssign={(p: Project) => { setSelectedProject(p); setIsAssignModalOpen(true); }}
                    />
                </motion.div>
            )}

            {/* PROJECTS TAB */}
            {activeTab === 'projects' && (
                <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="space-y-6">
                    <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border">
                         <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search all projects..." 
                                className="pl-10 bg-background border-input focus:border-emerald-500/50"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                         </div>
                         <div className="flex gap-2">
                             <Button variant="outline" className="border-border hover:bg-muted"><Filter className="h-4 w-4 mr-2" /> Filter</Button>
                             <Button variant="outline" className="border-border hover:bg-muted"><RefreshCw className="h-4 w-4" /></Button>
                         </div>
                    </div>
                    
                    <div className="rounded-2xl border border-border bg-card overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project Name</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead>Assigned To</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project) => (
                                    <TableRow key={project.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center border border-border">
                                                    <FileVideo className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground">{project.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono">ID: {project.id.slice(0,6)}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{project.clientName}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={project.status} />
                                        </TableCell>
                                        <TableCell className="font-mono text-foreground">₹{project.totalCost?.toLocaleString() || 0}</TableCell>
                                        <TableCell>
                                            {project.assignedEditorId ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold border border-indigo-500/30">
                                                        ED
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">Editor</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button size="icon" variant="ghost" onClick={() => { setSelectedProject(project); setEditForm({totalCost: project.totalCost||0, status: project.status}); setIsEditModalOpen(true); }} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"><Edit className="h-4 w-4" /></Button>
                                                <Button size="icon" variant="ghost" onClick={() => { setSelectedProject(project); setIsAssignModalOpen(true); }} className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10"><UserPlus className="h-4 w-4" /></Button>
                                                <Button size="icon" variant="ghost" onClick={() => handleDeleteProject(project.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </motion.div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="space-y-6">
                     <div className="grid gap-6 lg:grid-cols-2">
                        <UserTable title="Clients" users={users.filter(u => u.role === 'client')} onDelete={handleDeleteUser} />
                        <UserTable title="Editors" users={users.filter(u => u.role === 'editor')} onDelete={handleDeleteUser} />
                     </div>
                </motion.div>
            )}
       </AnimatePresence>

       {/* Modals maintained from original code but styled consistently */}
       <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign Team Member">
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {users.filter(u => u.role === 'editor').map(ed => (
                    <button key={ed.uid} onClick={() => handleAssignEditor(ed.uid)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted border border-border hover:border-primary/50 transition-all text-left group">
                        <Avatar className="h-10 w-10 border border-border">
                            <AvatarFallback className="bg-primary/20 text-primary font-bold">{ed.displayName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-foreground font-medium group-hover:text-primary transition-colors">{ed.displayName}</p>
                            <p className="text-xs text-muted-foreground">{ed.email}</p>
                        </div>
                    </button>
                ))}
            </div>
       </Modal>

       <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Quick Actions">
            <div className="space-y-6 pt-4">
                 <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase font-bold tracking-widest pl-1">Project Value (₹)</label>
                    <Input type="number" value={editForm.totalCost} onChange={e => setEditForm({...editForm, totalCost: Number(e.target.value)})} className="bg-background border-border h-12 text-lg font-mono" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase font-bold tracking-widest pl-1">Status Phase</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['pending_assignment', 'active', 'in_review', 'approved', 'completed'].map(s => (
                            <button
                                key={s}
                                onClick={() => setEditForm({...editForm, status: s})}
                                className={cn(
                                    "px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all text-left",
                                    editForm.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground hover:border-foreground/20"
                                )}
                            >
                                {s.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                 </div>
                 <Button onClick={handleUpdateProject} className="w-full bg-foreground text-background hover:bg-foreground/90 h-12 font-bold rounded-xl mt-4">Save Changes</Button>
            </div>
       </Modal>
    </div>
  );
}

// --- SUB COMPONENTS FOR "TABLE" LOOK --- //

function Table({ children }: { children: React.ReactNode }) {
    return <div className="w-full text-sm text-left">{children}</div>;
}

function TableHeader({ children }: { children: React.ReactNode }) {
    return <div className="bg-muted/50 border-b border-border font-medium text-muted-foreground uppercase tracking-wider text-xs">{children}</div>;
}

function TableBody({ children }: { children: React.ReactNode }) {
    return <div className="divide-y divide-border/50">{children}</div>;
}

function TableRow({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-6 gap-4 items-center px-6 py-4 hover:bg-muted/30 transition-colors">{children}</div>;
}

function TableHead({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("px-2 py-3", className)}>{children}</div>;
}

function TableCell({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("px-2", className)}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
     const config: any = {
        pending_assignment: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        active: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        in_review: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        completed: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
    };
    return (
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border", config[status] || config['active'])}>
            {status.replace('_', ' ')}
        </span>
    );
}

function StatsCard({ label, value, icon: Icon, color, trend }: any) {
    return (
        <div className="p-6 rounded-2xl bg-card border border-border relative overflow-hidden group hover:border-foreground/20 transition-all shadow-sm ">
            <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2 rounded-lg bg-muted", color)}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1 bg-muted/80 px-2 py-1 rounded-full border border-border">
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-muted-foreground font-medium">{trend}</span>
                </div>
            </div>
            <div className="space-y-1">
                <div className="text-3xl font-bold text-foreground tracking-tight font-heading">{value}</div>
                <span className="text-sm text-muted-foreground font-medium">{label}</span>
            </div>
        </div>
    );
}

function RecentTable({ title, headers, data, type, onAssign }: any) {
    return (
        <div className="bg-card border border-border rounded-3xl overflow-hidden flex flex-col h-full shadow-sm">
            <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="font-bold text-foreground">{title}</h3>
                <Link href="#" className="text-xs text-primary hover:underline">View Report</Link>
            </div>
            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-3 px-6 py-3 bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {headers.map((h:any) => <div key={h}>{h}</div>)}
                </div>
                <div className="divide-y divide-border">
                    {data.length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm italic">No records found</p> : data.map((item: any) => (
                        <div key={item.id} className="grid grid-cols-3 px-6 py-4 text-sm items-center hover:bg-muted/20 transition-colors">
                            <div className="font-medium text-foreground truncate pr-4">{item.name}</div>
                            {type === 'project' ? (
                                <StatusBadge status={item.status} />
                            ) : (
                                <div className="text-muted-foreground">{item.clientName}</div>
                            )}
                            <div className="flex items-center">
                                {type === 'project' ? (
                                    <span className="text-muted-foreground font-mono text-xs">{new Date(item.updatedAt).toLocaleDateString()}</span>
                                ) : (
                                     <Button size="sm" onClick={() => onAssign(item)} className="h-7 text-xs bg-foreground text-background hover:bg-foreground/80">Assign</Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function UserTable({ title, users, onDelete }: any) {
    return (
        <div className="bg-card border border-border rounded-3xl overflow-hidden flex flex-col h-[500px] shadow-sm">
            <div className="p-6 border-b border-border">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                    {title} <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">{users.length}</span>
                </h3>
            </div>
            <div className="flex-1 overflow-auto">
                <div className="divide-y divide-border">
                    {users.map((u: any) => (
                         <div key={u.uid} className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-all group">
                             <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10 border border-border">
                                    <AvatarFallback className="bg-muted text-muted-foreground font-bold">{u.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-foreground font-medium text-sm">{u.displayName}</p>
                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-3">
                                 <span className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded border border-border uppercase tracking-wider">{u.role}</span>
                                 <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => onDelete(u.uid)}
                                    className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                             </div>
                         </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
