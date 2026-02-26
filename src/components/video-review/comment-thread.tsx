"use client";

import { Comment, UserRole } from "@/types/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, MessageSquare, Reply, X, Image as ImageIcon, Paperclip, Loader2, Download as DownloadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";

interface CommentThreadProps {
    comments: Comment[];
    activeCommentId: string | null;
    isAddingComment: boolean;
    draftTime: number | null;
    onSelectComment: (comment: Comment) => void;
    onResolveComment: (commentId: string) => void;
    onReply: (commentId: string, content: string, attachments?: string[]) => void;
    onSaveComment: (content: string, attachments?: string[]) => void;
    onCancelComment: () => void;
    onUploadFile?: (file: File) => Promise<string>;
}

export function CommentThread({ 
    comments, 
    activeCommentId, 
    isAddingComment,
    draftTime,
    onSelectComment, 
    onResolveComment,
    onReply,
    onSaveComment,
    onCancelComment,
    onUploadFile
}: CommentThreadProps) {
    
    // Sort comments by timestamp
    const sortedComments = [...comments].sort((a, b) => a.timestamp - b.timestamp);
    const [draftContent, setDraftContent] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [draftAttachments, setDraftAttachments] = useState<string[]>([]);
    
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
    const [isUploadingReply, setIsUploadingReply] = useState(false);

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const replyInputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const replyFileInputRef = useRef<HTMLInputElement>(null);

    // This would ideally be handled by a parent or a hook, 
    // but for simplicity in this component we'll pass the file up or handle here.
    // Let's assume onSaveComment handles the content.
    // If we want to allow immediate upload, we need a prop for that.
    // For now, let's just allow the parent to handle the full save.

    useEffect(() => {
        if (isAddingComment && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAddingComment]);

    const handleSave = () => {
        if (!draftContent.trim() && draftAttachments.length === 0) return;
        onSaveComment(draftContent, draftAttachments);
        setDraftContent("");
        setDraftAttachments([]);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isReply: boolean = false) => {
        const file = e.target.files?.[0];
        if (!file || !onUploadFile) return;

        if (isReply) setIsUploadingReply(true); 
        else setIsUploading(true);

        try {
            const url = await onUploadFile(file);
            if (isReply) setReplyAttachments(prev => [...prev, url]);
            else setDraftAttachments(prev => [...prev, url]);
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            if (isReply) setIsUploadingReply(false);
            else setIsUploading(false);
            if (e.target) e.target.value = "";
        }
    };

    const handleSendReply = (commentId: string) => {
        if (!replyContent.trim() && replyAttachments.length === 0) return;
        onReply(commentId, replyContent, replyAttachments);
        setReplyContent("");
        setReplyAttachments([]);
        setReplyingTo(null);
    };

    const handleDownloadFile = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed:", error);
            // Fallback: open in new tab
            window.open(url, '_blank');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            onCancelComment();
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-l border-white/10">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900 z-10">
                <h3 className="font-bold text-base text-white">Project Feedback ({comments.length})</h3>
                {isAddingComment && (
                    <Button variant="ghost" size="icon" onClick={onCancelComment} className="h-6 w-6 text-zinc-400 hover:text-white">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
            
            <ScrollArea className="flex-1 p-4 shadow-inner">
                <div className="space-y-4 pb-20">
                    {/* Draft Input Area */}
                    {isAddingComment && (
                        <div className="p-4 rounded-xl border border-primary/50 bg-primary/5 shadow-lg mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                             <div className="flex items-center gap-2 mb-3">
                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                                    Note at {formatTime(draftTime || 0)}
                                </span>
                            </div>
                            <Textarea
                                ref={inputRef}
                                value={draftContent}
                                onChange={(e) => setDraftContent(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type your feedback here..."
                                className="min-h-[100px] bg-black/50 border-primary/20 focus:border-primary/50 resize-none text-[15px] mb-3 p-4"
                            />

                            {/* Attachment Previews */}
                            {draftAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {draftAttachments.map((url, idx) => (
                                        <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-white/10 group/img">
                                            <img src={url} alt="upload" className="h-full w-full object-cover" />
                                            <button 
                                                onClick={() => setDraftAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-black/50 p-0.5 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                                            >
                                                <X className="h-3 w-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden" 
                                        accept="image/*"
                                    />
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        disabled={isUploading}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-zinc-400 hover:text-white h-8 w-8 p-0"
                                    >
                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={onCancelComment} className="text-zinc-400 hover:text-white h-8">
                                        Cancel
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={isUploading} className="bg-primary hover:bg-primary/90 h-8">
                                        Add Comment
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {sortedComments.length === 0 && !isAddingComment && (
                        <div className="text-center py-10 text-zinc-500">
                            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No messages here yet.</p>
                            <p className="text-xs">Pick a moment on the timeline to share your feedback.</p>
                        </div>
                    )}

                    {sortedComments.map((comment) => (
                        <div 
                            key={comment.id}
                            onClick={() => onSelectComment(comment)}
                            className={cn(
                                "p-4 rounded-xl border transition-all cursor-pointer group relative overflow-hidden",
                                activeCommentId === comment.id 
                                    ? "bg-primary/5 border-primary/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                                    : "bg-zinc-800/50 border-white/5 hover:bg-zinc-800 hover:border-white/10"
                            )}
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7 ring-1 ring-white/10">
                                        <AvatarImage src={comment.userAvatar || undefined} />
                                        <AvatarFallback className="text-[11px] bg-zinc-700 text-zinc-300 font-bold">
                                            {comment.userName.substring(0,2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-[14px] font-bold text-zinc-200">{comment.userName}</span>
                                        <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">{comment.userRole}</span>
                                    </div>
                                    <span className="ml-auto text-[11px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-400 font-bold">
                                        {formatTime(comment.timestamp)}
                                    </span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onResolveComment(comment.id); }}
                                    className="text-zinc-500 hover:text-emerald-500 transition-colors p-1"
                                >
                                    {comment.status === 'resolved' ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                        <Circle className="h-4 w-4" />
                                    )}
                                </button>
                            </div>

                            <p className={cn(
                                "text-[15px] mb-4 leading-relaxed",
                                comment.status === 'resolved' ? "text-muted-foreground line-through decoration-zinc-500 decoration-2" : "text-zinc-100"
                            )}>
                                {comment.content}
                            </p>

                            {/* Comment Attachments */}
                            {comment.attachments && comment.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {comment.attachments.map((url, idx) => (
                                        <div key={idx} className="relative h-32 w-auto min-w-[120px] max-w-full rounded-xl overflow-hidden border border-white/10 bg-black/20 group/att shadow-2xl">
                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                <img src={url} alt="attachment" className="h-full w-auto object-contain cursor-zoom-in" />
                                            </a>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="absolute bottom-1 right-1 h-6 w-6 p-0 bg-black/60 text-white opacity-0 group-hover/att:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownloadFile(url, `attachment-${idx}`);
                                                }}
                                            >
                                                <DownloadIcon className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Replies would go here */}
                            {comment.replies && comment.replies.length > 0 && (
                                <div className="ml-4 pl-3 border-l-2 border-white/5 space-y-3 mt-2">
                                    {comment.replies.map(reply => (
                                        <div key={reply.id} className="text-[13px] text-zinc-400">
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className="font-bold text-zinc-200">{reply.userName}</span>
                                                <span className="text-[11px] text-zinc-600 font-bold uppercase">{new Date(reply.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <p className="mb-2 leading-relaxed">{reply.content}</p>
                                            {reply.attachments && reply.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                    {reply.attachments.map((url, idx) => (
                                                        <div key={idx} className="relative h-20 w-auto rounded-lg border border-white/5 overflow-hidden bg-black/20 group/ratt">
                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                <img src={url} alt="attachment" className="h-full w-auto object-contain cursor-zoom-in" />
                                                            </a>
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                className="absolute bottom-0.5 right-0.5 h-5 w-5 p-0 bg-black/60 text-white opacity-0 group-hover/ratt:opacity-100 transition-opacity"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDownloadFile(url, `reply-attachment-${idx}`);
                                                                }}
                                                            >
                                                                <DownloadIcon className="h-2.5 w-2.5" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reply Input Area */}
                            {replyingTo === comment.id ? (
                                <div className="mt-4 p-3 rounded-lg border border-white/10 bg-black/20 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <Textarea
                                        ref={replyInputRef}
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="Type your reply here..."
                                        className="min-h-[70px] bg-transparent border-none focus-visible:ring-0 text-[14px] p-0 mb-3 resize-none leading-relaxed"
                                    />
                                    
                                    {replyAttachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {replyAttachments.map((url, idx) => (
                                                <div key={idx} className="relative h-12 w-12 rounded border border-white/10 overflow-hidden group/rimg">
                                                    <img src={url} alt="reply upload" className="h-full w-full object-cover" />
                                                    <button 
                                                        onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="absolute top-0.5 right-0.5 bg-black/70 p-0.5 rounded-full opacity-0 group-hover/rimg:opacity-100 transition-opacity"
                                                    >
                                                        <X className="h-2 w-2 text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center">
                                            <input 
                                                type="file" 
                                                ref={replyFileInputRef}
                                                onChange={(e) => handleFileChange(e, true)}
                                                className="hidden" 
                                                accept="image/*"
                                            />
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                disabled={isUploadingReply}
                                                onClick={() => replyFileInputRef.current?.click()}
                                                className="text-zinc-500 hover:text-white h-7 w-7 p-0"
                                            >
                                                {isUploadingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)} className="h-7 text-[10px] px-2 text-zinc-400">
                                                Cancel
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                onClick={() => handleSendReply(comment.id)} 
                                                disabled={isUploadingReply || (!replyContent.trim() && replyAttachments.length === 0)}
                                                className="h-7 text-[10px] px-3 bg-zinc-700 hover:bg-zinc-600"
                                            >
                                                Reply
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 pt-2 mt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                        onClick={(e) => { e.stopPropagation(); setReplyingTo(comment.id); }}
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-[10px] text-zinc-400 hover:text-white hover:bg-white/5"
                                    >
                                        <Reply className="h-3 w-3 mr-1" /> Reply
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
