"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutDashboard, Users, FolderOpen, LogOut } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { collection, query, orderBy, onSnapshot, updateDoc, doc, arrayUnion } from "firebase/firestore";
import { Project } from "@/types/schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ProjectManagerDashboard() {
    const { user, logout } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [editors, setEditors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Assignment Modal State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    useEffect(() => {
        // 1. Fetch Projects
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const unsubProjects = onSnapshot(q, (snapshot) => {
            setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
            setLoading(false);
        });

        // 2. Fetch Editors
        const editorsQ = query(collection(db, "users"));
        const unsubEditors = onSnapshot(editorsQ, (snapshot) => {
             // Filter for editors client-side or use where clause if index exists. 
             // Doing client-side for simplicity as requested in similar tasks (assuming low volume).
             const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
             setEditors(allUsers.filter((u: any) => u.role === 'editor'));
        });

        return () => {
            unsubProjects();
            unsubEditors();
        };
    }, []);

    const handleAssignEditor = async (editorId: string) => {
        if (!selectedProject) return;
        try {
            await updateDoc(doc(db, "projects", selectedProject.id), {
                 assignedEditorId: editorId,
                 status: 'active', // Move to active once assigned
                 members: arrayUnion(editorId), // Add to members allow-list
                 updatedAt: Date.now()
            });
            toast.success(`Project assigned to editor!`);
            setIsAssignModalOpen(false);
            setSelectedProject(null);
        } catch (err) { 
            console.error(err);
            toast.error("Failed to assign project"); 
        }
    };

    return (
        <div className="flex min-h-screen bg-black text-white">
            {/* Sidebar */}
            <div className="w-64 border-r border-white/10 p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-10">
                    <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-600 bg-clip-text text-transparent">
                        PM Portal
                    </span>
                </div>

                <div className="space-y-2 flex-1">
                    <Button variant="ghost" className="w-full justify-start gap-2 bg-blue-500/10 text-blue-400">
                        <LayoutDashboard className="w-4 h-4" />
                        Overview
                    </Button>
                </div>

                <Button variant="ghost" className="justify-start gap-2 text-zinc-400 hover:text-white" onClick={logout}>
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </Button>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Project Manager Dashboard</h1>
                        <p className="text-zinc-400 text-sm">Oversee and assign projects to editors.</p>
                    </div>
                    <div className="flex text-sm text-zinc-500 gap-4">
                        <span>Total Projects: <strong className="text-white">{projects.length}</strong></span>
                        <span>Available Editors: <strong className="text-white">{editors.length}</strong></span>
                    </div>
                </header>

                <div className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-black/20">
                        <h2 className="font-semibold text-white">All Active Projects</h2>
                    </div>
                    
                    {loading ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 className="animate-spin text-primary" />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                            No projects found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-zinc-400 uppercase bg-black/40">
                                    <tr>
                                        <th className="px-6 py-3">Project</th>
                                        <th className="px-6 py-3">Client</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Assigned To</th>
                                        <th className="px-6 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projects.map((project) => {
                                        const assignedEditor = editors.find(e => e.uid === project.assignedEditorId);
                                        return (
                                        <tr key={project.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">
                                                {project.name}
                                                <div className="text-xs text-zinc-500 mt-0.5">{project.videoType}</div>
                                            </td>
                                            <td className="px-6 py-4 text-zinc-400">
                                                {project.brand}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-full text-[10px] uppercase font-bold border",
                                                    project.status === 'completed' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                                    project.status === 'pending_assignment' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                    "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                                )}>
                                                    {project.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {assignedEditor ? (
                                                     <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold">
                                                            {assignedEditor.displayName?.[0]}
                                                        </div>
                                                        <span className="text-zinc-300">{assignedEditor.displayName}</span>
                                                     </div>
                                                ) : (
                                                    <span className="text-zinc-600 italic text-xs">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button 
                                                    size="sm" 
                                                    className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border border-white/10"
                                                    onClick={() => { setSelectedProject(project); setIsAssignModalOpen(true); }}
                                                >
                                                    {project.assignedEditorId ? 'Reassign' : 'Assign Editor'}
                                                </Button>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Assignment Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="font-bold text-lg text-white">Assign Editor</h3>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                                <Users className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
                             <p className="text-sm text-zinc-400 mb-4">Select an editor for <strong>{selectedProject?.name}</strong>:</p>
                             {editors.length === 0 ? (
                                 <p className="text-center text-zinc-500 py-8">No editors found in the team.</p>
                             ) : (
                                 editors.map((editor) => {
                                     // Calculate Active Workload
                                     const activeCount = projects.filter(p => 
                                         p.assignedEditorId === editor.uid && 
                                         !['completed', 'approved'].includes(p.status)
                                     ).length;
                                     
                                     const isFull = activeCount >= 5;
                                     const isCurrent = selectedProject?.assignedEditorId === editor.uid;

                                     return (
                                     <button 
                                        key={editor.uid}
                                        disabled={isFull && !isCurrent}
                                        onClick={() => !isFull && handleAssignEditor(editor.uid)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group relative",
                                            isFull && !isCurrent ? "opacity-50 cursor-not-allowed bg-red-500/5 border-transparent" : "hover:bg-white/5 border-transparent hover:border-white/10"
                                        )}
                                     >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                            {editor.displayName?.[0]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-medium group-hover:text-indigo-400 transition-colors">{editor.displayName}</p>
                                                {isFull ? (
                                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">FULL (5/5)</span>
                                                ) : (
                                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", activeCount > 2 ? "text-yellow-400 bg-yellow-500/10" : "text-green-400 bg-green-500/10")}>
                                                        {activeCount}/5 Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-500">{editor.email}</p>
                                        </div>
                                        {isCurrent && (
                                            <span className="ml-auto text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full">Current</span>
                                        )}
                                     </button>
                                 )})
                             )}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                            <Button variant="ghost" onClick={() => setIsAssignModalOpen(false)} className="text-zinc-400 hover:text-white">Cancel</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
