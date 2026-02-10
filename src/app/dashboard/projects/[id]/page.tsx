"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { db, storage } from "@/lib/firebase/config";
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Project, Revision } from "@/types/schema";
import { 
    Loader2, 
    ArrowLeft, 
    Upload, 
    FileVideo, 
    Download, 
    DollarSign, 
    Calendar, 
    Clock, 
    CheckCircle2, 
    Play, 
    MoreVertical,
    Share2,
    Link as LinkIcon,
    ExternalLink,
    Briefcase,
    ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectChat } from "@/components/project-chat";
import { toast } from "sonner";
import { assignEditor, getAllUsers, respondToAssignment } from "@/app/actions/admin-actions";
import { User, ProjectAssignmentStatus } from "@/types/schema";
import { Modal } from "@/components/ui/modal";
import { PaymentButton } from "@/components/payment-button";

interface ExtendedProject extends Project {
    brand?: string;
    duration?: number;
    deadline?: string;
    totalCost?: number;
    amountPaid?: number;
    footageLink?: string;
    assignmentStatus?: ProjectAssignmentStatus;
}

export default function ProjectDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [project, setProject] = useState<ExtendedProject | null>(null);
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Admin Assignment State
    const [editors, setEditors] = useState<User[]>([]);
    const [assigning, setAssigning] = useState(false);
    
    // Asset Upload State
    const [isUploadingAsset, setIsUploadingAsset] = useState(false);
    const [uploadAssetProgress, setUploadAssetProgress] = useState(0);

    const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !project) return;
        const file = e.target.files[0];
        
        setIsUploadingAsset(true);
        try {
            const storageRef = ref(storage, `raw_footage/${project.ownerId}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadAssetProgress(progress);
                    }, 
                    (error) => reject(error), 
                    () => resolve()
                );
            });

            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newFileMetadata = {
                name: file.name,
                url: downloadURL,
                size: file.size,
                type: file.type,
                uploadedAt: Date.now()
            };

            await updateDoc(doc(db, "projects", project.id), {
                rawFiles: arrayUnion(newFileMetadata)
            });

            // Update local state
            setProject(prev => prev ? {
                ...prev,
                rawFiles: [...(prev.rawFiles || []), newFileMetadata]
            } : null);

            toast.success("Asset uploaded successfully");

        } catch (error) {
            console.error("Asset upload failed:", error);
            toast.error("Failed to upload asset");
        } finally {
            setIsUploadingAsset(false);
            setUploadAssetProgress(0);
        }
    };

    useEffect(() => {
        async function fetchData() {
            if (!id || typeof id !== 'string') return;
            try {
                const pSnap = await getDoc(doc(db, "projects", id));
                if (pSnap.exists()) {
                    setProject({ id: pSnap.id, ...pSnap.data() } as ExtendedProject);
                }

                const q = query(
                    collection(db, "revisions"),
                    where("projectId", "==", id),
                    orderBy("version", "desc")
                );
                const rSnap = await getDocs(q);
                const revs: Revision[] = [];
                rSnap.forEach(doc => revs.push({ id: doc.id, ...doc.data() } as Revision));
                setRevisions(revs);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        
        if (!authLoading) fetchData();
    }, [id, authLoading]);

    // Admin: Fetch Editors
    useEffect(() => {
        if (user?.role === 'admin') {
            getAllUsers().then(res => {
                if (res.success && res.data) {
                    const allUsers = res.data as User[];
                    setEditors(allUsers.filter(u => u.role === 'editor'));
                }
            });
        }
    }, [user]);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedEditorId, setSelectedEditorId] = useState<string | null>(null);

    const handleFinalPayment = () => {
        setIsPaymentModalOpen(true);
    };

    const handleAssignmentResponse = async (response: 'accepted' | 'rejected') => {
        if (!id || typeof id !== 'string') return;
        try {
            await respondToAssignment(id, response);
            setProject(prev => prev ? ({ 
                ...prev, 
                assignmentStatus: response,
                status: response === 'accepted' ? 'active' : 'pending_assignment' 
            }) : null);
            toast.success(`Project ${response}`);
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    if (loading || authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!project) return null;

    const latestRevision = revisions[0];
    const isClient = user?.role === 'client' || project.ownerId === user?.uid;
    const isAdmin = user?.role === 'admin';
    const isEditor = user?.role === 'editor';
    const isAssignedEditor = isEditor && project.assignedEditorId === user?.uid;
    const isPaymentLocked = isClient && project.paymentStatus !== 'full_paid';

    // Logic: Admin feedback tool lock
    const showFeedbackTool = isAdmin ? (project.assignmentStatus === 'accepted') : true;

    // EDITOR OFFER VIEW
    if (isAssignedEditor && project.assignmentStatus === 'pending') {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
                <div className="max-w-2xl w-full bg-[#09090b] border border-zinc-800 rounded-3xl p-10 space-y-8 shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-purple-600" />
                     
                     <div className="text-center space-y-4">
                        <div className="mx-auto h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                            <Briefcase className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold">New Project Opportunity</h1>
                        <p className="text-zinc-400 max-w-md mx-auto">
                            You have been invited to work on 
                            <span className="text-white font-bold mx-1">{project.name}</span>. 
                            Review the details below and accept to start.
                        </p>
                     </div>

                     <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 space-y-4">
                        <DetailRow label="Client / Brand" value={project.brand || project.clientName || 'Unknown'} />
                        <DetailRow label="Deadline" value={project.deadline ? `Due ${project.deadline}` : "Flexible"} />
                        <div className="pt-4 border-t border-zinc-800">
                             <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Requirements</p>
                             <p className="text-zinc-300 italic">"{project.description || "Check assets for details."}"</p>
                        </div>
                     </div>

                     <div className="flex gap-4 pt-4">
                        <Button 
                            onClick={() => handleAssignmentResponse('rejected')} 
                            variant="outline" 
                            className="flex-1 h-14 text-base border-zinc-700 hover:bg-zinc-800 hover:text-red-400"
                        >
                            Decline
                        </Button>
                        <Button 
                            onClick={() => handleAssignmentResponse('accepted')} 
                            className="flex-1 h-14 text-base bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                        >
                            Accept Job
                        </Button>
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
                
                {/* Header */}
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-8">
                    <div className="space-y-4">
                        <Link href="/dashboard" className="text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                             <ArrowLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                             Back to Workspace
                        </Link>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-4xl font-bold tracking-tight font-heading">{project.name}</h1>
                            <div className={cn(
                                "px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest border",
                                project.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                "bg-blue-500/10 border-blue-500/20 text-blue-500"
                            )}>
                                {project.status?.replace('_', ' ')}
                            </div>
                        </div>
                        <p className="text-zinc-500 text-sm">
                            Project ID: <span className="text-zinc-300 font-mono">{id}</span>
                            <span className="mx-3">•</span>
                            Managed by <span className="text-zinc-300">EditoHub Team</span>
                        </p>
                    </div>

                    <div className="flex gap-3">
                         <Button variant="outline" className="border-zinc-800 bg-transparent hover:bg-zinc-900 rounded-xl px-6 h-12">
                            <Share2 className="h-4 w-4 mr-2" /> Share
                         </Button>
                         {(isAdmin || (isAssignedEditor && (project.assignmentStatus === 'accepted' || project.status === 'active'))) && (
                            <Link href={`/dashboard/projects/${id}/upload`}>
                                <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl px-6 h-12">
                                    <Upload className="h-4 w-4 mr-2" /> Draft Upload
                                </Button>
                            </Link>
                         )}
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Column (8 units) */}
                    <div className="lg:col-span-8 space-y-8">
                        
                        {/* Latest Version Display */}
                        {revisions.length > 0 ? (
                            <div className="space-y-6">
                                <div className="group relative aspect-video bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
                                    {/* Mock Player / Banner */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-50" />
                                        <FileVideo className="h-20 w-20 text-zinc-900" />
                                    </div>
                                    
                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm">
                                        {showFeedbackTool ? (
                                            <Link href={`/dashboard/projects/${id}/review/${latestRevision.id}`}>
                                                <button className="h-20 w-20 bg-primary rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-2xl shadow-primary/40">
                                                    <Play className="h-8 w-8 text-white fill-white ml-2" />
                                                </button>
                                            </Link>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="h-20 w-20 bg-zinc-800 rounded-full flex items-center justify-center cursor-not-allowed text-zinc-500">
                                                    <Play className="h-8 w-8 ml-2" />
                                                </div>
                                                <span className="text-xs bg-black/80 px-2 py-1 rounded text-red-400 font-medium">
                                                    {project.assignmentStatus === 'pending' ? 'Pending Editor Acceptance' : 'Assign Editor First'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Strip */}
                                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                        <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            <span className="text-sm font-semibold">Version {latestRevision.version} (Latest)</span>
                                        </div>
                                        <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-sm">
                                            {new Date(latestRevision.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#09090b] p-6 rounded-3xl border border-zinc-800">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-lg">Ready for Review</h3>
                                        <p className="text-sm text-zinc-500">Provide feedback directly on the video timeline.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        {showFeedbackTool && (
                                            <Link href={`/dashboard/projects/${id}/review/${latestRevision.id}`}>
                                                <Button variant="outline" className="h-11 border-zinc-800 hover:bg-zinc-900 rounded-xl px-6">Feedback Tool</Button>
                                            </Link>
                                        )}
                                        {isClient && isPaymentLocked ? (
                                            <Button onClick={handleFinalPayment} className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8 rounded-xl shadow-lg shadow-emerald-900/20">
                                                <DollarSign className="h-4 w-4 mr-2" />
                                                Unlock Download
                                            </Button>
                                        ) : (
                                            <Button className="bg-primary hover:bg-primary/90 h-11 px-8 rounded-xl shadow-lg shadow-primary/20">
                                                <Download className="h-4 w-4 mr-2" /> Download
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="aspect-video bg-[#09090b] rounded-3xl border border-dashed border-zinc-800 flex flex-col items-center justify-center p-12 text-center shadow-inner">
                                <div className="h-20 w-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                                    <Upload className="h-8 w-8 text-zinc-600" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Workspace Initialized</h3>
                                <p className="text-zinc-500 max-w-sm mb-8">
                                    {(isEditor || isAdmin) ? "No drafts uploaded. Start the production process by uploading your first edit." : "The editor is currently working on your first draft. You'll be notified once it's ready."}
                                </p>
                                {(isAdmin || (isAssignedEditor && (project.assignmentStatus === 'accepted' || project.status === 'active'))) && (
                                    <Link href={`/dashboard/projects/${id}/upload`}>
                                        <Button className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-semibold">Upload First Draft</Button>
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* Revision History */}
                        {revisions.length > 1 && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg ml-2">History</h3>
                                <div className="grid gap-3">
                                    {revisions.slice(1).map(rev => (
                                        <Link href={`/dashboard/projects/${id}/review/${rev.id}`} key={rev.id}>
                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/30 border border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 bg-zinc-800 rounded-lg flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                        <FileVideo className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm">Version {rev.version}</p>
                                                        <p className="text-xs text-zinc-500">{new Date(rev.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="ghost" className="text-zinc-500 hover:text-white">View</Button>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Project Chat Integrated */}
                         <div className="bg-[#09090b] rounded-3xl border border-zinc-800 overflow-hidden mt-8 shadow-xl">
                             <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                                 <h3 className="font-bold text-lg">Project Communications</h3>
                                 <div className="flex items-center gap-2">
                                     <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                     <span className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Active Thread</span>
                                 </div>
                             </div>
                             <div className="h-[400px]">
                                <ProjectChat projectId={id as string} currentUser={user} assignedEditorId={project.toString() === '' ? undefined : project.assignedEditorId} />
                             </div>
                        </div>

                    </div>

                    {/* Right Column (4 units) */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* Admin: Assignment Card */}
                        {isAdmin && (
                            <div className="bg-[#09090b] rounded-3xl border border-zinc-800 p-6 space-y-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-base uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4" /> 
                                        Team Assignment
                                    </h3>
                                    
                                     <Button 
                                        onClick={() => setIsAssignModalOpen(true)}
                                        size="sm"
                                        className="h-7 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg px-3"
                                    >
                                        {project.assignedEditorId ? "Change Editor" : "Assign Editor"}
                                    </Button>
                                </div>
                                
                                {project.assignedEditorId ? (
                                    <div className={cn(
                                        "flex items-center gap-3 p-4 rounded-xl border bg-zinc-900/50 border-zinc-800/50 transition-all"
                                    )}>
                                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                            {editors.find(e => e.uid === project.assignedEditorId)?.displayName?.substring(0,2).toUpperCase() || "ED"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-200 truncate">
                                                {editors.find(e => e.uid === project.assignedEditorId)?.displayName || "Assigned Editor"}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-zinc-500 truncate">{editors.find(e => e.uid === project.assignedEditorId)?.email}</p>
                                                <span className={cn(
                                                    "text-[10px] uppercase font-bold px-1.5 rounded",
                                                    project.assignmentStatus === 'pending' ? "bg-yellow-500/10 text-yellow-500" :
                                                    project.assignmentStatus === 'accepted' ? "bg-emerald-500/10 text-emerald-500" :
                                                    "bg-red-500/10 text-red-500"
                                                )}>
                                                    {project.assignmentStatus || 'Assigned'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
                                        <p className="text-zinc-500 text-sm">No editor assigned yet.</p>
                                    </div>
                                )}

                                {/* Assignment Modal */}
                                <Modal
                                    isOpen={isAssignModalOpen}
                                    onClose={() => setIsAssignModalOpen(false)}
                                    title="Assign Team Member"
                                >
                                    <div className="space-y-4">
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {editors.map((editor) => {
                                                const isSelected = selectedEditorId === editor.uid;
                                                return (
                                                    <div 
                                                        key={editor.uid}
                                                        onClick={() => setSelectedEditorId(editor.uid)}
                                                        className={cn(
                                                            "flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all hover:bg-zinc-800/80",
                                                            isSelected ? "bg-zinc-800 border-primary/50 ring-1 ring-primary/50" : "bg-zinc-900/40 border-zinc-800"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors",
                                                            isSelected ? "bg-primary text-white" : "bg-zinc-800 text-zinc-400"
                                                        )}>
                                                            {editor.displayName?.substring(0, 1).toUpperCase() || (editor.email || '?')[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className={cn("text-sm font-semibold", isSelected ? "text-white" : "text-zinc-300")}>
                                                                {editor.displayName || "Unknown Name"}
                                                            </p>
                                                            <p className="text-xs text-zinc-500">{editor.email}</p>
                                                        </div>
                                                        <div className={cn(
                                                            "h-4 w-4 rounded-full border flex items-center justify-center",
                                                            isSelected ? "border-primary bg-primary" : "border-zinc-600"
                                                        )}>
                                                            {isSelected && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="pt-4 flex justify-end">
                                            <Button 
                                                onClick={async () => {
                                                    if (!selectedEditorId) return;
                                                    setAssigning(true);
                                                    try {
                                                        await assignEditor(id as string, selectedEditorId);
                                                        setProject(prev => prev ? ({ ...prev, assignedEditorId: selectedEditorId, assignmentStatus: 'pending', status: 'pending_assignment' }) : null);
                                                        toast.success("Editor assigned successfully");
                                                        setIsAssignModalOpen(false);
                                                    } catch (err) {
                                                        toast.error("Failed to assign editor");
                                                    } finally {
                                                        setAssigning(false);
                                                    }
                                                }}
                                                disabled={assigning || !selectedEditorId}
                                                className="bg-primary hover:bg-primary/90 text-white rounded-xl px-6"
                                            >
                                                {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign Member"}
                                            </Button>
                                        </div>
                                    </div>
                                </Modal>
                            </div>
                        )}

                        {/* Project Brief Card */}
                        <div className="bg-[#09090b] rounded-3xl border border-zinc-800 p-6 space-y-6 shadow-xl">
                            <h3 className="font-bold text-base uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <LinkIcon className="h-4 w-4" /> 
                                Project Brief
                            </h3>
                            
                            <div className="grid gap-4">
                                <DetailRow label="Brand" value={project.brand || project.clientName} />
                                <DetailRow label="Timeline" value={project.deadline ? `Due ${project.deadline}` : "TBD"} />
                                <DetailRow label="Duration" value={`${project.duration || 0} mins`} />
                                <div className="pt-4 border-t border-zinc-900">
                                    <label className="text-[10px] text-zinc-600 uppercase font-bold mb-2 block tracking-widest">Requirements</label>
                                    <p className="text-sm text-zinc-400 leading-relaxed italic line-clamp-4">
                                        "{project.description || "No specific requirements provided."}"
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Raw Assets Card */}
                        <div className="bg-[#09090b] rounded-3xl border border-zinc-800 p-6 space-y-6 shadow-xl">
                            <h3 className="font-bold text-base uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <Briefcase className="h-4 w-4" /> 
                                Production Assets
                            </h3>
                            
                            {/* 1. Existing Cloud Link */}
                            {project.footageLink && (
                                <a 
                                    href={project.footageLink.startsWith('http') ? project.footageLink : `https://${project.footageLink}`} 
                                    target="_blank" 
                                    className="block p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-primary/50 transition-all group mb-4"
                                >
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Cloud Master Repository</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-300 font-medium group-hover:text-primary truncate mr-2">Open External Link</span>
                                        <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-primary" />
                                    </div>
                                </a>
                            )}

                            {/* 2. Raw Files List */}
                            {project.rawFiles && project.rawFiles.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Uploaded Files</p>
                                    {project.rawFiles.map((file, idx) => (
                                        <a 
                                            key={idx}
                                            href={file.url}
                                            target="_blank"
                                            className="flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-900 rounded-xl border border-zinc-800 transition-colors group"
                                        >
                                            <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:bg-primary/10">
                                                <FileVideo className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-300 truncate group-hover:text-white">{file.name}</p>
                                                <p className="text-[10px] text-zinc-500">{(file.size ? (file.size / (1024*1024)).toFixed(2) : '?')} MB • {new Date(file.uploadedAt || 0).toLocaleDateString()}</p>
                                            </div>
                                            <Download className="h-4 w-4 text-zinc-600 group-hover:text-white" />
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* 3. Upload Action */}
                            {isClient && (
                                <div className="relative">
                                    {isUploadingAsset ? (
                                        <div className="h-10 w-full bg-zinc-900/50 rounded-xl border border-zinc-800 flex items-center px-4 gap-3">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary transition-all duration-300"
                                                    style={{ width: `${uploadAssetProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Button className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs h-10 rounded-xl relative overflow-hidden group">
                                                <div className="flex items-center gap-2 relative z-10">
                                                    <Upload className="h-3 w-3" />
                                                    Upload New Asset
                                                </div>
                                                <input 
                                                    type="file" 
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                                    onChange={handleAssetUpload}
                                                />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!project.footageLink && (!project.rawFiles || project.rawFiles.length === 0) && !isClient && (
                                <div className="text-center py-6 bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
                                    <p className="text-xs text-zinc-600">No assets provided yet.</p>
                                </div>
                            )}

                        </div>

                        {/* Status Timeline */}
                        <div className="bg-[#09090b] rounded-3xl border border-zinc-800 p-6 space-y-6 shadow-xl">
                            <h3 className="font-bold text-base uppercase tracking-widest text-zinc-500">Milestones</h3>
                            <div className="space-y-6 relative">
                                <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-zinc-900" />
                                <Milestone label="Discovery" date="Complete" active />
                                <Milestone label="Editing Phase" date={revisions.length > 0 ? "In Progress" : "Pending"} active={revisions.length > 0} />
                                <Milestone label="Revision Cycle" date="Scheduled" active={revisions.length > 0} />
                                <Milestone label="Final Handover" date="Pending" active={project.status === 'completed'} />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Payment Modal */}
                <Modal
                   isOpen={isPaymentModalOpen}
                   onClose={() => setIsPaymentModalOpen(false)}
                   title="Payment Required"
                >
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                            <div className="h-10 w-10 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">Outstanding Balance</h4>
                                <p className="text-xs text-amber-200/70">You must settle the invoice to download final assets.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-400">Total Project Value</span>
                                <span className="text-white font-medium">${project?.totalCost?.toLocaleString() || '0.00'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-400">Amount Paid</span>
                                <span className="text-white font-medium">${project?.amountPaid?.toLocaleString() || '0.00'}</span>
                            </div>
                            <div className="h-px bg-white/10 my-2" />
                            <div className="flex justify-between text-base font-bold">
                                <span className="text-white">Due Now</span>
                                <span className="text-primary">${((project?.totalCost || 0) - (project?.amountPaid || 0)).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="pt-2">
                            <div className="w-full">
                                <PaymentButton 
                                    projectId={id as string}
                                    amount={(project?.totalCost || 0) - (project?.amountPaid || 0)}
                                    description={`Remaining Balance for ${project?.name}`}
                                    prefill={{
                                        name: user?.displayName || "",
                                        email: user?.email || ""
                                    }}
                                    onSuccess={() => {
                                        setProject(prev => prev ? ({ ...prev, paymentStatus: 'full_paid', status: 'completed' }) : null);
                                        setIsPaymentModalOpen(false);
                                        toast.success("Payment Received via Razorpay! Downloads unlocked.");
                                    }}
                                />
                            </div>
                            <p className="text-center text-xs text-zinc-500 mt-3">
                                Secure payment processing via Razorpay
                            </p>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">{label}</span>
            <span className="font-semibold text-zinc-200">{value}</span>
        </div>
    );
}

function Milestone({ label, date, active }: { label: string, date: string, active?: boolean }) {
    return (
        <div className="flex items-start gap-4 relative z-10">
            <div className={cn(
                "h-[20px] w-[20px] rounded-full border-4 border-black transition-colors duration-500 shadow-xl",
                active ? "bg-primary scale-110" : "bg-zinc-800"
            )} />
            <div className="space-y-0.5">
                <p className={cn("text-xs font-bold uppercase tracking-wider", active ? "text-zinc-200" : "text-zinc-600")}>{label}</p>
                <p className="text-[10px] text-zinc-600">{date}</p>
            </div>
        </div>
    );
}

