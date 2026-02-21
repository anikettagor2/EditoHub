"use client";

import { useEffect, useRef, useState, use } from "react";
import { VideoPlayer, VideoPlayerHandle } from "@/components/video-review/video-player";
import { CommentThread } from "@/components/video-review/comment-thread";
import { TimelineComments } from "@/components/video-review/timeline-comments";
import { GuestIdentityModal } from "@/components/video-review/guest-identity-modal";
import { Comment, Revision, UserRole } from "@/types/schema";
import { doc, collection, query, where, onSnapshot, setDoc, updateDoc, orderBy, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Share2, Download, MessageSquarePlus, DollarSign, Loader2, ShieldCheck, Film } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/context/auth-context";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import { registerDownload, requestDownloadUnlock } from "@/app/actions/project-actions";

export default function PublicReviewPage(props: { params: Promise<{ id: string; revisionId: string }> }) {
  const params = use(props.params); 
  const { user, loading: authLoading } = useAuth();
  const playerRef = useRef<VideoPlayerHandle>(null);
  
  // State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Guest State
  const [guestInfo, setGuestInfo] = useState<{name: string, email: string} | null>(null);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

  // Real Data State
  const [revision, setRevision] = useState<Revision | null>(null);
  const [project, setProject] = useState<any>(null); 
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  // Force Guest Identity for Public Viewers
  useEffect(() => {
    if (!authLoading && !user && !guestInfo) {
      setIsGuestModalOpen(true);
    }
  }, [authLoading, user, guestInfo]);

  // 1. Real-time Revision & Project Details
  useEffect(() => {
    if (!params.id || !params.revisionId) return;

    const unsubRev = onSnapshot(doc(db, "revisions", params.revisionId), (snap) => {
      if (snap.exists()) {
        setRevision({ id: snap.id, ...snap.data() } as Revision);
      }
    });

    const unsubProj = onSnapshot(doc(db, "projects", params.id), (snap) => {
      if (snap.exists()) {
        setProject({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });

    return () => {
      unsubRev();
      unsubProj();
    };
  }, [params.id, params.revisionId]);

  // 2. Real-time Comments Sync
  useEffect(() => {
    if (!params.revisionId) return;

    const q = query(
        collection(db, "comments"),
        where("revisionId", "==", params.revisionId),
        orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedComments: Comment[] = [];
        snapshot.forEach((doc) => {
            fetchedComments.push({ id: doc.id, ...doc.data() } as Comment);
        });
        setComments(fetchedComments);
    });

    return () => unsubscribe();
  }, [params.revisionId]);

  const handleDownloadAttempt = () => {
      const isClient = user?.role === 'client' || user?.uid === project?.ownerId;
      if (isClient && project?.paymentStatus !== 'full_paid') {
          setIsUnlockModalOpen(true);
      } else {
          if (revision?.videoUrl) {
              window.open(revision.videoUrl, '_blank');
          }
      }
  };

  const handleRequestUnlock = async () => {
      if (!params.id || !user?.uid) return;
      setIsRequesting(true);
      try {
          const res = await requestDownloadUnlock(params.id, user.uid);
          if (res.success) {
              toast.success("Request sent to project manager!");
              setIsUnlockModalOpen(false);
          } else {
              toast.error(res.error || "Failed to send request");
          }
      } catch (err) {
          toast.error("An error occurred");
      } finally {
          setIsRequesting(false);
      }
  };

  const [isAddingComment, setIsAddingComment] = useState(false);
  const [draftTime, setDraftTime] = useState<number | null>(null);
  const waitingForGuest = useRef(false);

  const handleTimeUpdate = (time: number) => setCurrentTime(time);
  const handleSeek = (time: number) => playerRef.current?.seekTo(time);

  const handleSelectComment = (comment: Comment) => {
     setActiveCommentId(comment.id);
     playerRef.current?.seekTo(comment.timestamp);
     playerRef.current?.pause();
  };

  const handleGuestIdentify = (name: string, email: string) => {
      setGuestInfo({ name, email });
      setIsGuestModalOpen(false);
      if (waitingForGuest.current) {
          setIsAddingComment(true);
          setDraftTime(currentTime);
          waitingForGuest.current = false;
      }
  };

  const handleAddCommentStart = () => {
      if (!user && !guestInfo) {
          playerRef.current?.pause();
          waitingForGuest.current = true;
          setIsGuestModalOpen(true);
          return;
      }
      playerRef.current?.pause();
      setDraftTime(currentTime);
      setIsAddingComment(true);
      setIsSidebarOpen(true);
  };

  const handleCancelComment = () => {
      setIsAddingComment(false);
      setDraftTime(null);
      playerRef.current?.play();
  };

  const handleSaveComment = async (content: string) => {
      if (!draftTime && draftTime !== 0) return;
      const newId = uuidv4(); 
      const userId = user?.uid || (guestInfo?.email ? `guest-${guestInfo.email}` : `guest-${Date.now()}`);
      const userName = user?.displayName || guestInfo?.name || "Guest";
      const userRole: UserRole = user?.role || 'guest';

      const newComment: Comment = {
          id: newId, 
          projectId: params.id,
          revisionId: params.revisionId,
          userId: userId,
          userName: userName,
          userRole: userRole,
          userAvatar: user?.photoURL || null,
          content: content, 
          timestamp: draftTime!,
          createdAt: Date.now(),
          status: "open",
          replies: []
      };

      setComments(prev => [...prev, newComment]);
      setIsAddingComment(false);
      setDraftTime(null);
      setActiveCommentId(newId);
      
      try {
          const { id, ...data } = newComment;
          await setDoc(doc(db, "comments", newId), data);
      } catch (err) {
          console.error("Failed to add comment:", err);
          setComments(prev => prev.filter(c => c.id !== newId));
          toast.error("Failed to save comment");
      }
  };

  const handleResolveComment = async (commentId: string) => {
      const originalComments = [...comments];
      const targetComment = comments.find(c => c.id === commentId);
      if (!targetComment) return;
      const newStatus = targetComment.status === 'open' ? 'resolved' : 'open';
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, status: newStatus } : c));
      try {
          await updateDoc(doc(db, "comments", commentId), { status: newStatus });
      } catch (err) {
          setComments(originalComments);
      }
  };

  const handleReply = async (commentId: string, content: string) => {
      if (!user && !guestInfo) {
          setIsGuestModalOpen(true);
          return;
      }
      const userId = user?.uid || (guestInfo?.email ? `guest-${guestInfo.email}` : `guest-${Date.now()}`);
      const userName = user?.displayName || guestInfo?.name || "Guest";
      const userRole: UserRole = user?.role || 'guest';
      const newReply = {
          id: uuidv4(),
          userId: userId,
          userName: userName,
          userRole: userRole,
          content,
          createdAt: Date.now()
      };
      setComments(prev => prev.map(c => {
          if (c.id === commentId) return { ...c, replies: [...(c.replies || []), newReply] };
          return c;
      }));
      try {
          await updateDoc(doc(db, "comments", commentId), { replies: arrayUnion(newReply) });
      } catch (err) {}
  };

  if (loading) {
      return (
          <div className="flex h-screen items-center justify-center bg-black">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }

  if(!revision && !loading) return <div className="text-white p-10">Revision not found</div>;

  const isInternalUser = user?.role === "admin" || user?.role === "project_manager" || user?.role === "editor";
  const isProjectOwner = user?.uid === project?.ownerId || user?.uid === project?.clientId;
  
  // Downloads are unlocked if the project is paid OR explicit override OR user is internal
  const isUnlocked = project?.paymentStatus === "full_paid" || project?.downloadsUnlocked === true || isInternalUser;
  const showPaymentLock = !isUnlocked;

  return (
    <div className="flex h-screen flex-col bg-black text-white overflow-hidden">
       {/* Public Header */}
       <header className="flex h-16 items-center justify-between border-b border-white/10 px-4 bg-zinc-900/50 backdrop-blur">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 font-bold text-lg tracking-tight mr-4">
                <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <Film className="h-5 w-5" />
                </div>
                <span className="hidden sm:inline">EditoHub</span>
             </div>
             <div className="h-8 w-px bg-white/10 hidden sm:block" />
             <div>
                <h1 className="text-sm font-bold text-white uppercase tracking-wider">{project?.name || "Review"}</h1>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                   <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider">V{revision?.version || '?'}</span>
                   <span>Shared Review</span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-3">
              {showPaymentLock && (
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-500 uppercase">
                      <ShieldCheck className="h-3 w-3" />
                      View Only Mode
                  </div>
              )}
              
              {/* Only show download button if unlocked, or if project owner can see the unlock modal */}
              {(!showPaymentLock || isProjectOwner) ? (
                  <Button 
                    onClick={async () => {
                        if (!showPaymentLock) {
                            try {
                                const res = await registerDownload(params.id, params.revisionId);
                                if (!res.success) {
                                    toast.error(res.error || "Download limit reached");
                                    return;
                                }
                                if (res.downloadUrl) {
                                    window.location.href = res.downloadUrl;
                                }
                            } catch (e) {
                                toast.error("Failed to process download");
                            }
                        } else {
                            setIsUnlockModalOpen(true);
                        }
                    }}
                    size="sm" 
                    variant="outline" 
                    disabled={!showPaymentLock && (revision?.downloadCount || 0) >= 3}
                    className={cn(
                        "h-8 gap-2 bg-transparent border-zinc-700 hover:text-white transition-colors",
                        !showPaymentLock ? "text-zinc-300" : "text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
                    )}
                  >
                     {!showPaymentLock ? <Download className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                     <span className="hidden sm:inline">
                        {!showPaymentLock 
                          ? ((revision?.downloadCount || 0) >= 3 ? "Expired" : `Download (${3 - (revision?.downloadCount || 0)} left)`)
                          : "Unlock Full Quality"}
                     </span>
                  </Button>
              ) : (
                  <div className="flex items-center gap-2 px-3 h-8 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-500 text-xs font-medium grayscale">
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Download Locked</span>
                  </div>
              )}

              <Button size="sm" variant="outline" onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url);
                  toast.success("Link copied to clipboard!");
              }} className="h-8 gap-2 bg-transparent border-zinc-700 hover:text-white transition-colors">
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Copy Link</span>
              </Button>
          </div>
       </header>

       <div className="flex flex-1 overflow-hidden">
          <main className="relative flex-1 flex flex-col items-center justify-center bg-zinc-950 p-6">
             <div className="relative w-full max-w-5xl aspect-video bg-black shadow-2xl rounded-xl border border-white/5 overflow-visible">
                {revision && (
                    <VideoPlayer 
                        ref={playerRef}
                        src={revision.videoUrl} 
                        onTimeUpdate={handleTimeUpdate}
                        onDurationChange={setDuration}
                    />
                )}
                
                 <div className="absolute -bottom-6 left-0 right-0 h-8">
                     <TimelineComments 
                        duration={duration} 
                        comments={comments} 
                        onSeek={handleSeek}
                        hoverTime={hoverTime}
                     />
                 </div>
             </div>

             <div className="mt-12 flex gap-4">
                 <Button onClick={handleAddCommentStart} className="gap-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 shadow-lg transition-transform active:scale-95">
                    <MessageSquarePlus className="h-4 w-4" />
                    {isAddingComment ? "Commenting..." : `Add Comment at ${Math.floor(currentTime)}s`}
                 </Button>
             </div>
          </main>

          <aside className={cn(
              "w-96 border-l border-white/10 bg-zinc-900 flex flex-col transition-all duration-300",
              !isSidebarOpen && "w-0 opacity-0 overflow-hidden"
          )}>
              <CommentThread 
                 comments={comments}
                 activeCommentId={activeCommentId}
                 isAddingComment={isAddingComment}
                 draftTime={draftTime}
                 onSelectComment={handleSelectComment}
                 onResolveComment={handleResolveComment}
                 onReply={handleReply}
                 onSaveComment={handleSaveComment}
                 onCancelComment={handleCancelComment}
              />
          </aside>
       </div>
       
       <GuestIdentityModal 
            isOpen={isGuestModalOpen}
            onIdentify={handleGuestIdentify}
            onClose={() => {
                if (user || guestInfo) {
                    setIsGuestModalOpen(false);
                } else {
                    toast.info("Identification required", {
                        description: "Please enter your name to participate in the review."
                    });
                }
            }}
       />

       {/* Unlock Download Modal */}
       <Modal
           isOpen={isUnlockModalOpen}
           onClose={() => setIsUnlockModalOpen(false)}
           title="Unlock Final Downloads"
       >
            <div className="space-y-6">
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
                   <div className="flex items-center justify-between">
                       <span className="text-zinc-400 text-sm font-medium">Project</span>
                       <span className="text-white text-sm font-semibold">{project?.name}</span>
                   </div>
                   <div className="flex justify-between items-center">
                       <span className="text-zinc-400 text-sm font-medium">Due Balance</span>
                       <span className="text-primary font-mono font-bold">${((project?.totalCost || 0) - (project?.amountPaid || 0)).toLocaleString()}</span>
                   </div>
                </div>

                <div className="grid gap-3">
                    <button 
                        onClick={handleRequestUnlock}
                        disabled={isRequesting || project?.downloadUnlockRequested}
                        className={cn(
                            "w-full group relative flex flex-col items-start p-4 rounded-2xl border transition-all text-left",
                            project?.downloadUnlockRequested 
                                ? "bg-zinc-900/50 border-zinc-800 cursor-not-allowed opacity-70" 
                                : "bg-zinc-900 border-zinc-800 hover:border-primary/50 hover:bg-zinc-800/50"
                        )}
                    >
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                {isRequesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            </div>
                            <span className="font-bold text-white">
                                {project?.downloadUnlockRequested ? "Request Sent" : "Request PM Approval"}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 ml-11">Request access from your project manager. Best for direct billing accounts.</p>
                        
                        {project?.downloadUnlockRequested && (
                            <div className="absolute top-4 right-4 text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-bold border border-emerald-500/20">
                                PENDING
                            </div>
                        )}
                    </button>

                    <div className="relative group grayscale cursor-not-allowed">
                        <div className="flex flex-col items-start p-4 rounded-2xl border border-zinc-800 bg-zinc-900 opacity-50">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                                    <DollarSign className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-zinc-400">Pay Now & Unlock</span>
                            </div>
                            <p className="text-xs text-zinc-500 ml-11 italic">Instant unlock via direct payment (Currently Disabled)</p>
                        </div>
                        <div className="absolute inset-0 z-10" />
                    </div>
                </div>

                <p className="text-center text-[11px] text-zinc-500 leading-relaxed px-4">
                    By requesting an unlock, you agree to our settlement terms. Once approved, the download button will be enabled for this revision.
                </p>
            </div>
       </Modal>
    </div>
  );
}
