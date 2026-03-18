"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Project } from "@/types/schema";
import { cn } from "@/lib/utils";
import { 
    Loader2,
    Eye,
    IndianRupee,
    CheckCircle2,
    Clock,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function EditorDashboardV2() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

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
        });

        return () => { unsubscribe(); };
    }, [user]);

    // Filter projects based on search
    const filteredProjects = projects.filter(p => 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Count statistics
    const activeProjects = projects.filter(p => p.status === 'active');
    const completedProjects = projects.filter(p => ['completed', 'approved'].includes(p.status));
    const totalEarnings = completedProjects.reduce((acc, curr) => acc + (curr.editorPrice || 0), 0);
    const pendingEarnings = projects
        .filter(p => ['completed', 'approved'].includes(p.status) && !p.editorPaid)
        .reduce((acc, p) => acc + (p.editorPrice || 0), 0);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'active': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
            case 'in_review': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
            case 'completed': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
            case 'approved': return 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    const getStatusIcon = (status: string) => {
        switch(status) {
            case 'active': return <Clock className="h-4 w-4" />;
            case 'in_review': return <AlertCircle className="h-4 w-4" />;
            case 'completed':
            case 'approved': return <CheckCircle2 className="h-4 w-4" />;
            default: return null;
        }
    };

    const getStatusLabel = (status: string) => {
        return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const getPaymentStatus = (project: Project) => {
        if (!['completed', 'approved'].includes(project.status)) {
            return { label: 'Pending', color: 'text-muted-foreground' };
        }
        return project.editorPaid 
            ? { label: 'Paid', color: 'text-emerald-500 font-bold' }
            : { label: 'Unpaid', color: 'text-amber-500 font-bold' };
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            {/* Video Preview Modal - Top Level */}
            <AnimatePresence>
                {previewVideoUrl && (
                    <motion.div 
                        key="video-preview-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 pointer-events-auto" 
                        onClick={() => setPreviewVideoUrl(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="relative w-full h-full md:h-auto md:max-w-7xl md:aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_0_200px_rgba(0,0,0,0.8)]" 
                            onClick={e => e.stopPropagation()}
                        >
                            <button 
                                onClick={() => setPreviewVideoUrl(null)} 
                                className="absolute top-6 right-6 h-12 w-12 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-md z-[10000] transition-all hover:bg-white/40"
                            >
                                <X className="h-6 w-6" />
                            </button>
                            <video 
                                src={previewVideoUrl} 
                                controls 
                                className="w-full h-full object-contain" 
                                autoPlay
                                controlsList="nodownload"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Projects</h1>
                    <p className="text-muted-foreground mt-1">All projects assigned to you with payment and status information.</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-card border border-border rounded-xl p-5">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Total Projects</div>
                        <div className="text-3xl font-black text-foreground tabular-nums">{projects.length}</div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-5">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Active</div>
                        <div className="text-3xl font-black text-blue-500 tabular-nums">{activeProjects.length}</div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-5">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Completed</div>
                        <div className="text-3xl font-black text-emerald-500 tabular-nums">{completedProjects.length}</div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-5">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Payment Pending</div>
                        <div className="text-3xl font-black text-amber-500 tabular-nums">₹{pendingEarnings.toLocaleString()}</div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search projects by name or client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                </div>

                {/* Projects Table */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-4 md:p-5 border-b border-border flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground">Assigned Projects</h2>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{filteredProjects.length} projects</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Project Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Assigned PM</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Editor Share</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Payment</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">PM Remarks</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-14 text-center text-sm text-muted-foreground">
                                            {projects.length === 0 ? 'No projects assigned yet.' : 'No projects match your search.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProjects.map((project, index) => {
                                        const paymentStatus = getPaymentStatus(project);
                                        return (
                                            <tr key={project.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-4">
                                                    <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="font-semibold text-foreground">{project.name}</div>
                                                    <div className="text-xs text-muted-foreground">{project.clientName || 'N/A'}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="text-sm font-medium text-foreground">{(project as any).assignedPMName || 'Project Manager'}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="text-sm font-bold text-emerald-500 tabular-nums">
                                                        ₹{(project.editorPrice || 0).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className={cn(
                                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
                                                        getStatusColor(project.status)
                                                    )}>
                                                        {getStatusIcon(project.status)}
                                                        {getStatusLabel(project.status)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className={cn("text-sm", paymentStatus.color)}>
                                                        {['completed', 'approved'].includes(project.status) 
                                                            ? paymentStatus.label 
                                                            : 'N/A'
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="max-w-xs">
                                                        <p className="text-sm text-muted-foreground truncate hover:text-foreground transition-colors" title={(project as any).pmRemarks || 'No remarks'}>
                                                            {(project as any).pmRemarks || '—'}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 space-y-2">
                                                    <Link
                                                        href={`/dashboard/projects/${project.id}`}
                                                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                                                    >
                                                        View Details
                                                    </Link>
                                                    {project.rawFiles && project.rawFiles.length > 0 && (
                                                        <button
                                                            onClick={() => setPreviewVideoUrl(project.rawFiles?.[0]?.url || '')}
                                                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-semibold transition-colors"
                                                            title={project.rawFiles?.[0]?.name || 'Preview'}
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            Preview
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Earnings Summary */}
                {completedProjects.length > 0 && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="font-semibold text-emerald-600 dark:text-emerald-400 text-lg mb-1">Total Earnings</h3>
                                <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70">From all completed projects</p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    ₹{totalEarnings.toLocaleString()}
                                </p>
                                {pendingEarnings > 0 && (
                                    <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                        ₹{pendingEarnings.toLocaleString()} pending payment
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
