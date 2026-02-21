"use client";

import { useState, useEffect } from "react";
import { 
    collection, 
    query, 
    orderBy, 
    updateDoc, 
    doc,
    arrayUnion,
    onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Project, User } from "@/types/schema";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Users, 
    Search, 
    Filter, 
    Trash2, 
    UserPlus, 
    AlertCircle, 
    DollarSign,
    RefreshCw,
    Edit,
    FileVideo,
    MoreHorizontal,
    ArrowUpRight,
    ArrowDownLeft,
    CheckCircle2,
    Shield
} from "lucide-react";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

import { useSearchParams } from "next/navigation";
import { assignEditor, updateProject, togglePayLater, deleteProject, deleteUser } from "@/app/actions/admin-actions";

export function AdminDashboard() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'overview' | 'projects' | 'users' | 'team') || 'overview';
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'users' | 'team'>(initialTab);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // User Creation State
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'sales_executive', phoneNumber: '' });

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
    setLoading(true);

    const projectsQ = query(collection(db, "projects"), orderBy("updatedAt", "desc"));
    const unsubProjects = onSnapshot(projectsQ, (snapshot) => {
        const fetchedProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(fetchedProjects);
    });

    const usersQ = collection(db, "users");
    const unsubUsers = onSnapshot(usersQ, (snapshot) => {
        const fetchedUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        setUsers(fetchedUsers);
    });

    return () => {
        unsubProjects();
        unsubUsers();
    };
  }, [refreshKey]);

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

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsCreatingUser(true);
      try {
          const res = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  email: newUser.email,
                  password: newUser.password,
                   displayName: newUser.name,
                   role: newUser.role,
                   phoneNumber: newUser.phoneNumber,
                   createdBy: 'admin'
               })
          });
          
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Failed");
          }

           toast.success(`${newUser.role} created successfully!`);
           setNewUser({ name: '', email: '', password: '', role: 'sales_executive', phoneNumber: '' });
       } catch (err: any) {
          toast.error(err.message);
      } finally {
          setIsCreatingUser(false);
      }
  };

  const handleDeleteProject = async (projectId: string) => {
    if(!confirm("Are you sure?")) return;
    const result = await deleteProject(projectId);
    if (result.success) toast.success("Project deleted");
    else toast.error("Failed");
  };

  const handleDeleteUser = async (uid: string) => {
    if(!confirm("Are you sure?")) return;
    const result = await deleteUser(uid);
    if (result.success) toast.success("User deleted");
    else toast.error("Failed: " + result.error);
  };

   const handleAssignEditor = async (editorId: string) => {
    if (!selectedProject) return;
    try {
        const res = await assignEditor(selectedProject.id, editorId);
        if (res.success) {
            toast.success("Editor assigned & notification sent");
            setIsAssignModalOpen(false);
        } else {
            toast.error(res.error || "Failed");
        }
    } catch (err) { toast.error("Failed"); }
  };

   const handleUpdateProject = async () => {
      if (!selectedProject) return;
      try {
          const res = await updateProject(selectedProject.id, {
              totalCost: Number(editForm.totalCost),
              status: editForm.status
          });
          if (res.success) {
              toast.success("Project updated successfully");
              setIsEditModalOpen(false);
          } else {
              toast.error(res.error || "Failed");
          }
      } catch (err) { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-6 md:p-8 bg-background min-h-screen">
       {/* 1. Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-border">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Console</h1>
                <p className="text-sm text-muted-foreground mt-1">System Overview & Management</p>
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
                     {['overview', 'projects', 'users', 'team'].map(tab => (
                         <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={cn(
                                "px-4 py-1.5 text-xs font-semibold rounded-md capitalize transition-all",
                                activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                         >
                            {tab === 'team' ? 'Team' : tab}
                         </button>
                     ))}
                </div>
            </div>
       </div>

       {/* 2. KPIs */}
       {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard 
                    label="Total Revenue" 
                    value={`₹${stats.revenue.toLocaleString()}`} 
                    trend="+12.5%" 
                    trendUp={true}
                    subtext="Gross volume"
                />
                <MetricCard 
                    label="Active Projects" 
                    value={stats.activeProjects} 
                    trend="+4 new"
                    trendUp={true}
                    subtext="In pipeline"
                />
                <MetricCard 
                    label="Pending Assignment" 
                    value={stats.pendingAssignment} 
                    alert={stats.pendingAssignment > 0}
                    subtext="Requires action"
                />
                <MetricCard 
                    label="Total Users" 
                    value={stats.totalUsers} 
                    subtext="Registered accounts"
                />
            </div>
        )}

       {/* 3. Content Area */}
       <div className="rounded-lg border border-border bg-card shadow-sm flex flex-col min-h-[500px]">
            {/* Toolbar if needed */}
            {activeTab === 'projects' && (
                <div className="p-4 border-b border-border flex justify-between bg-muted/30">
                    <div className="relative w-72">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input 
                            placeholder="Search projects..." 
                            className="pl-9 h-9 bg-background" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="sm" className="h-9"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
                </div>
            )}

            <div className="overflow-x-auto">
                {/* OVERVIEW TABLE */}
                {activeTab === 'overview' && (
                    <table className="w-full text-sm text-left">
                         <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                            <tr>
                                <th className="px-6 py-3">Recent Activity</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {projects.slice(0, 8).map(project => (
                                <tr key={project.id} className="hover:bg-muted/50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium">{project.name}</div>
                                        <div className="text-xs text-muted-foreground">ID: {project.id.slice(0,6)}</div>
                                    </td>
                                    <td className="px-6 py-4"><StatusBadge status={project.status} /></td>
                                    <td className="px-6 py-4 text-muted-foreground text-xs">
                                        {/* @ts-ignore */}
                                        {new Date(project.updatedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedProject(project); setIsEditModalOpen(true); }}>
                                            <Edit className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* PROJECTS TABLE */}
                {activeTab === 'projects' && (
                     <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                           <tr>
                               <th className="px-6 py-3">Project</th>
                               <th className="px-6 py-3">Client</th>
                               <th className="px-6 py-3">Status</th>
                               <th className="px-6 py-3">Value</th>
                               <th className="px-6 py-3">Editor</th>
                               <th className="px-6 py-3 text-right">Actions</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-border">
                           {projects.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(project => (
                               <tr key={project.id} className="hover:bg-muted/50 group">
                                   <td className="px-6 py-4 font-medium">
                                       {project.name}
                                       <div className="text-xs text-muted-foreground font-normal mt-0.5 flex items-center gap-2">
                                           ID: {project.id.slice(0,6)}
                                           {(project as any).isPayLaterRequest && (
                                               <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1 rounded uppercase font-bold tracking-tighter">Pay Later</span>
                                           )}
                                       </div>
                                   </td>
                                   <td className="px-6 py-4 text-muted-foreground">{project.clientName}</td>
                                   <td className="px-6 py-4"><StatusBadge status={project.status} /></td>
                                   <td className="px-6 py-4 font-mono text-foreground">₹{project.totalCost}</td>
                                   <td className="px-6 py-4 text-xs">
                                        {project.assignedEditorId ? (
                                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 flex items-center w-fit gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Assigned
                                            </span>
                                        ) : (
                                            <span className="text-amber-600 italic">Unassigned</span>
                                        )}
                                   </td>
                                   <td className="px-6 py-4 text-right">
                                       <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setSelectedProject(project); setEditForm({totalCost: project.totalCost||0, status: project.status}); setIsEditModalOpen(true); }}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setSelectedProject(project); setIsAssignModalOpen(true); }}>
                                                    <UserPlus className="mr-2 h-4 w-4" /> Assign Editor
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDeleteProject(project.id)} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                       </DropdownMenu>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
                )}

                {/* USERS TABLE */}
                {activeTab === 'users' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-border">
                        {/* Clients Column */}
                        <div>
                            <div className="px-6 py-3 bg-muted/50 border-b border-border font-semibold text-xs uppercase text-muted-foreground">Clients</div>
                            <div className="divide-y divide-border">
                                {users.filter(u => u.role === 'client').map(u => (
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
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDeleteUser(u.uid)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Editors Column */}
                        <div>
                             <div className="px-6 py-3 bg-muted/50 border-b border-border font-semibold text-xs uppercase text-muted-foreground">Editors</div>
                             <div className="divide-y divide-border">
                                {users.filter(u => u.role === 'editor').map(u => (
                                    <div key={u.uid} className="px-6 py-4 flex items-center justify-between hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                             <Avatar className="h-8 w-8 border border-border">
                                                <AvatarFallback className="bg-indigo-50 text-indigo-600">{u.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium text-sm text-foreground">{u.displayName}</div>
                                                <div className="text-xs text-muted-foreground">{u.email}</div>
                                            </div>
                                        </div>
                                         <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDeleteUser(u.uid)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* TEAM TAB (Creation) */}
                {activeTab === 'team' && (
                    <div className="p-8">
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                             <div className="lg:col-span-1 border border-border rounded-lg p-6 bg-background space-y-4 shadow-sm">
                                 <h3 className="font-semibold flex items-center gap-2">
                                     <UserPlus className="h-5 w-5 text-primary" /> Create Internal User
                                 </h3>
                                 <form onSubmit={handleCreateUser} className="space-y-4">
                                     <div className="space-y-1">
                                         <Label>Full Name</Label>
                                         <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required className="bg-background" placeholder="e.g. John Doe" />
                                     </div>
                                     <div className="space-y-1">
                                         <Label>Email</Label>
                                         <Input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required className="bg-background" type="email" placeholder="john@company.com" />
                                     </div>
                                     <div className="space-y-1">
                                         <Label>Password</Label>
                                         <Input value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required className="bg-background" type="text" minLength={6} placeholder="Initial password" />
                                     </div>
                                     <div className="space-y-1">
                                         <Label>Phone Number (10 Digits)</Label>
                                         <div className="flex gap-2">
                                             <div className="flex items-center justify-center px-3 bg-muted border border-border rounded-lg text-xs font-bold text-muted-foreground">+91</div>
                                             <Input 
                                                 value={newUser.phoneNumber} 
                                                 onChange={e => setNewUser({...newUser, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                                                 required 
                                                 pattern="[0-9]{10}"
                                                 className="bg-background" 
                                                 placeholder="9876543210" 
                                             />
                                         </div>
                                     </div>
                                     <div className="space-y-1">
                                         <Label>Role</Label>
                                         <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                             <option value="sales_executive">Sales Executive</option>
                                             <option value="project_manager">Project Manager</option>
                                         </select>
                                     </div>
                                     <Button className="w-full" disabled={isCreatingUser}>
                                         {isCreatingUser ? "Creating..." : "Create Account"}
                                     </Button>
                                 </form>
                             </div>
                             
                             <div className="lg:col-span-2 space-y-6">
                                 <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="bg-muted/50 px-6 py-3 border-b border-border font-semibold text-xs text-muted-foreground uppercase">Sales Executives</div>
                                    <div className="divide-y divide-border bg-background">
                                        {users.filter(u => u.role === 'sales_executive').map(u => (
                                            <div key={u.uid} className="px-6 py-4 flex justify-between items-center group">
                                                 <div>
                                                     <div className="font-medium text-sm">{u.displayName}</div>
                                                     <div className="text-xs text-muted-foreground">{u.email}</div>
                                                 </div>
                                                 <div className="flex items-center gap-2">
                                                     {u.initialPassword && <span className="text-xs font-mono bg-muted px-2 py-1 rounded select-all">PW: {u.initialPassword}</span>}
                                                     <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-600" onClick={() => handleDeleteUser(u.uid)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                 </div>
                                            </div>
                                        ))}
                                        {users.filter(u => u.role === 'sales_executive').length === 0 && (
                                            <div className="px-6 py-4 text-sm text-muted-foreground text-center">No sales executives found.</div>
                                        )}
                                    </div>
                                 </div>

                                 <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="bg-muted/50 px-6 py-3 border-b border-border font-semibold text-xs text-muted-foreground uppercase">Project Managers</div>
                                    <div className="divide-y divide-border bg-background">
                                        {users.filter(u => u.role === 'project_manager').map(u => (
                                            <div key={u.uid} className="px-6 py-4 flex justify-between items-center group">
                                                 <div>
                                                     <div className="font-medium text-sm">{u.displayName}</div>
                                                     <div className="text-xs text-muted-foreground">{u.email}</div>
                                                 </div>
                                                 <div className="flex items-center gap-2">
                                                     {u.initialPassword && <span className="text-xs font-mono bg-muted px-2 py-1 rounded select-all">PW: {u.initialPassword}</span>}
                                                     <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-600" onClick={() => handleDeleteUser(u.uid)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                 </div>
                                            </div>
                                        ))}
                                        {users.filter(u => u.role === 'project_manager').length === 0 && (
                                            <div className="px-6 py-4 text-sm text-muted-foreground text-center">No project managers found.</div>
                                        )}
                                    </div>
                                 </div>
                             </div>
                         </div>
                    </div>
                )}
            </div>
       </div>

       {/* Modals */}
       <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign Editor">
             <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto">
                 {users.filter(u => u.role === 'editor').map(ed => (
                     <button key={ed.uid} onClick={() => handleAssignEditor(ed.uid)} className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors text-left border border-transparent hover:border-border">
                         <Avatar className="h-8 w-8">
                             <AvatarFallback className="text-xs">{ed.displayName?.[0]}</AvatarFallback>
                         </Avatar>
                         <div>
                             <div className="text-sm font-medium">{ed.displayName}</div>
                             <div className="text-xs text-muted-foreground">{ed.email}</div>
                         </div>
                     </button>
                 ))}
             </div>
       </Modal>

       <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Update Project">
             <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                     <Label>Project Value (₹)</Label>
                     <Input type="number" value={editForm.totalCost} onChange={e => setEditForm({...editForm, totalCost: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                     <Label>Project Status</Label>
                     <select className="w-full h-10 px-3 rounded-md border border-input bg-background" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                          <option value="pending_assignment">Pending Assignment</option>
                          <option value="active">Active</option>
                          <option value="in_review">In Review</option>
                          <option value="approved">Approved</option>
                          <option value="completed">Completed</option>
                     </select>
                  </div>
                  <Button onClick={handleUpdateProject} className="w-full mt-2">Save Changes</Button>
             </div>
       </Modal>
    </div>
  );
}

// Consistent components
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
