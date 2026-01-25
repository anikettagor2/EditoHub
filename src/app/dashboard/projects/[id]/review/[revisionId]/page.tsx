
"use client";

import { useEffect, useRef, useState, use } from "react";
import { VideoPlayer, VideoPlayerHandle } from "@/components/video-review/video-player";
import { CommentThread } from "@/components/video-review/comment-thread";
import { TimelineComments } from "@/components/video-review/timeline-comments";
import { GuestIdentityModal } from "@/components/video-review/guest-identity-modal";
import { Comment, Revision, UserRole } from "@/types/schema";
import { doc, getDoc, collection, query, where, onSnapshot, setDoc, updateDoc, orderBy, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Share2, Download, MessageSquarePlus, DollarSign, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/context/auth-context";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { PaymentButton } from "@/components/payment-button";
import { toast } from "sonner";

// Mock Data Source - In production this comes from Firestore
const MOCK_VIDEO_URL = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export default function ReviewPage(props: { params: Promise<{ id: string; revisionId: string }> }) {
  const params = use(props.params); 
  const { user } = useAuth();
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
  const [project, setProject] = useState<any>(null); // Store full project
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // 1. Fetch Revision & Project Details
  useEffect(() => {
    async function fetchData() {
        try {
            // Fetch Revision
            const revRef = doc(db, "revisions", params.revisionId);
            const revSnap = await getDoc(revRef);
            if (revSnap.exists()) {
                setRevision({ id: revSnap.id, ...revSnap.data() } as Revision);
            }

            // Fetch Project
            const projRef = doc(db, "projects", params.id);
            const projSnap = await getDoc(projRef);
            if (projSnap.exists()) {
                setProject({ id: projSnap.id, ...projSnap.data() });
            }
        } catch (error) {
            console.error("Error fetching review data:", error);
        }
    }
    fetchData();
  }, [params]);


  const handleDownloadAttempt = () => {
      // Logic: If user is client AND not fully paid, block execution
      const isClient = user?.role === 'client' || user?.uid === project?.ownerId;
      
      if (isClient && project?.paymentStatus !== 'full_paid') {
          setIsPaymentModalOpen(true);
      } else {
          // Proceed to download
          if (revision?.videoUrl) {
              window.open(revision.videoUrl, '_blank');
          }
      }
  };

  // 2. Real-time Comments Sync
  useEffect(() => {
    if (!params.revisionId) return;

    const q = query(
        collection(db, "comments"),
        where("revisionId", "==", params.revisionId),
        orderBy("timestamp", "asc") // Order by video time
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedComments: Comment[] = [];
        snapshot.forEach((doc) => {
            fetchedComments.push({ id: doc.id, ...doc.data() } as Comment);
        });
        setComments(fetchedComments);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [params.revisionId]);

  // Draft State
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [draftTime, setDraftTime] = useState<number | null>(null);

  // ... (keep useEffects)

  const handleTimeUpdate = (time: number) => {
     setCurrentTime(time);
  };

  const handleSeek = (time: number) => {
     playerRef.current?.seekTo(time);
  };

  const handleSelectComment = (comment: Comment) => {
     setActiveCommentId(comment.id);
     playerRef.current?.seekTo(comment.timestamp);
     playerRef.current?.pause();
  };

  const handleGuestIdentify = (name: string, email: string) => {
      setGuestInfo({ name, email });
      setIsGuestModalOpen(false);
      // Resume adding comment if that was the intent
      if (waitingForGuest.current) {
          setIsAddingComment(true);
          setDraftTime(currentTime);
          waitingForGuest.current = false;
      }
  };

  const waitingForGuest = useRef(false);

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
      setIsSidebarOpen(true); // Ensure sidebar is open to show input
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
          userAvatar: user?.photoURL || undefined,
          content: content, 
          timestamp: draftTime!,
          createdAt: Date.now(),
          status: "open",
          replies: []
      };

      // Optimistic Update
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
          alert("Failed to save comment. Please try again.");
      }
  };

  const handleResolveComment = async (commentId: string) => {
      // Optimistic
      const originalComments = [...comments];
      const targetComment = comments.find(c => c.id === commentId);
      if (!targetComment) return;

      const newStatus = targetComment.status === 'open' ? 'resolved' : 'open';
      
      setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, status: newStatus } : c
      ));

      try {
          await updateDoc(doc(db, "comments", commentId), {
              status: newStatus
          });
      } catch (err) {
          console.error("Failed to update status:", err);
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

      // Optimistic
      setComments(prev => prev.map(c => {
          if (c.id === commentId) {
              return { ...c, replies: [...(c.replies || []), newReply] };
          }
          return c;
      }));

      try {
          await updateDoc(doc(db, "comments", commentId), {
              replies: arrayUnion(newReply)
          });
      } catch (err) {
          console.error("Failed to reply:", err);
      }
  };

  if(!revision && !loading) return <div className="text-white p-10">Revision not found</div>;

  return (
    <div className="flex h-screen flex-col bg-black text-white overflow-hidden">
       {/* Top Bar for Review Page */}
       <header className="flex h-16 items-center justify-between border-b border-white/10 px-4 bg-zinc-900/50 backdrop-blur">
          {/* ... (header content same as before) */}
          <div className="flex items-center gap-4">
             <Link href={`/dashboard/projects/${params.id}`} className="p-2 hover:bg-white/10 rounded-full transition">
                <ChevronLeft className="h-5 w-5" />
             </Link>
             <div>
                <h1 className="text-sm font-bold text-white">{project?.name || "Loading..."}</h1>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                   <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider">V{revision?.version || '?'}</span>
                   <span>Uploaded {revision ? new Date(revision.createdAt).toLocaleDateString() : '...'}</span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-3">
              <Button 
                onClick={handleDownloadAttempt}
                size="sm" 
                variant="outline" 
                className={cn(
                    "h-8 gap-2 bg-transparent border-zinc-700 hover:text-white transition-colors",
                    project?.paymentStatus === 'full_paid' ? "text-zinc-300" : "text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
                )}
              >
                 {project?.paymentStatus === 'full_paid' ? <Download className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                 <span className="hidden sm:inline">
                    {project?.paymentStatus === 'full_paid' ? "Download" : "Unlock Download"}
                 </span>
              </Button>
              <Button size="sm" className="h-8 gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                 <Share2 className="h-4 w-4" />
                 <span className="hidden sm:inline">Share Review</span>
              </Button>
          </div>
       </header>

       <div className="flex flex-1 overflow-hidden">
          {/* Main Video Area */}
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
                
                 {/* Floating Timeline Markers */}
                 <div className="absolute -bottom-6 left-0 right-0 h-8">
                     <TimelineComments 
                        duration={duration} 
                        comments={comments} 
                        onSeek={handleSeek}
                        hoverTime={hoverTime}
                     />
                 </div>
             </div>

             {/* Quick Actions Bar under video */}
             <div className="mt-12 flex gap-4">
                 <Button onClick={handleAddCommentStart} className="gap-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 shadow-lg transition-transform active:scale-95">
                    <MessageSquarePlus className="h-4 w-4" />
                    {isAddingComment ? "Commenting..." : `Add Comment at ${Math.floor(currentTime)}s`}
                 </Button>
             </div>
          </main>

          {/* Sidebar */}
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
            onClose={() => setIsGuestModalOpen(false)}
       />

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
                            projectId={params.id}
                            amount={(project?.totalCost || 0) - (project?.amountPaid || 0)}
                            description={`Remaining Balance for ${project?.name}`}
                            prefill={{
                                name: user?.displayName || "",
                                email: user?.email || ""
                            }}
                            onSuccess={() => {
                                setProject((prev: any) => ({ ...prev, paymentStatus: 'full_paid', status: 'completed' }));
                                setIsPaymentModalOpen(false);
                                toast.success("Downloads unlocked!");
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
  );
}
