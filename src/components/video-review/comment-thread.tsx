"use client";

import { Comment, UserRole } from "@/types/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, MessageSquare, Reply, X } from "lucide-react";
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
    onReply: (commentId: string, content: string) => void;
    onSaveComment: (content: string) => void;
    onCancelComment: () => void;
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
    onCancelComment
}: CommentThreadProps) {
    
    // Sort comments by timestamp
    const sortedComments = [...comments].sort((a, b) => a.timestamp - b.timestamp);
    const [draftContent, setDraftContent] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isAddingComment && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAddingComment]);

    const handleSave = () => {
        if (!draftContent.trim()) return;
        onSaveComment(draftContent);
        setDraftContent("");
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
                <h3 className="font-semibold text-white">Comments ({comments.length})</h3>
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
                                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                                    New Comment at {formatTime(draftTime || 0)}
                                </span>
                            </div>
                            <Textarea
                                ref={inputRef}
                                value={draftContent}
                                onChange={(e) => setDraftContent(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type your feedback here..."
                                className="min-h-[80px] bg-black/50 border-primary/20 focus:border-primary/50 resize-none text-sm mb-3"
                            />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={onCancelComment} className="text-zinc-400 hover:text-white h-8">
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90 h-8">
                                    Post Comment
                                </Button>
                            </div>
                        </div>
                    )}

                    {sortedComments.length === 0 && !isAddingComment && (
                        <div className="text-center py-10 text-zinc-500">
                            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No comments yet.</p>
                            <p className="text-xs">Click on the timeline to add one.</p>
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
                                    <Avatar className="h-6 w-6 ring-1 ring-white/10">
                                        <AvatarImage src={comment.userAvatar} />
                                        <AvatarFallback className="text-[10px] bg-zinc-700 text-zinc-300 font-bold">
                                            {comment.userName.substring(0,2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col leading-none">
                                        <span className="text-xs font-semibold text-zinc-200">{comment.userName}</span>
                                        <span className="text-[10px] text-zinc-500">{comment.userRole}</span>
                                    </div>
                                    <span className="ml-auto text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-zinc-400 font-mono">
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
                                "text-sm mb-3 leading-relaxed",
                                comment.status === 'resolved' ? "text-muted-foreground line-through decoration-zinc-500 decoration-2" : "text-zinc-100"
                            )}>
                                {comment.content}
                            </p>

                            {/* Replies would go here */}
                            {comment.replies && comment.replies.length > 0 && (
                                <div className="ml-4 pl-3 border-l-2 border-white/5 space-y-3 mt-2">
                                    {comment.replies.map(reply => (
                                        <div key={reply.id} className="text-xs text-zinc-400">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="font-bold text-zinc-300">{reply.userName}</span>
                                                <span className="text-[9px] text-zinc-600">{new Date(reply.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <p>{reply.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-zinc-400 hover:text-white hover:bg-white/5">
                                    <Reply className="h-3 w-3 mr-1" /> Reply
                                </Button>
                            </div>
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
