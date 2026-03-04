"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "@/types/schema";
import { ProjectMessage } from "@/types/schema";
import { db } from "@/lib/firebase/config";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, User as UserIcon, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectChatProps {
    projectId: string;
    currentUser: User | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ProjectChat({ projectId, currentUser, isOpen, onClose }: ProjectChatProps) {
    const [messages, setMessages] = useState<ProjectMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen || !projectId) return;

        const q = query(
            collection(db, "projects", projectId, "chat"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: ProjectMessage[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                msgs.push({
                    id: doc.id,
                    projectId: data.projectId,
                    senderId: data.senderId,
                    senderName: data.senderName,
                    senderRole: data.senderRole,
                    text: data.text,
                    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
                });
            });
            setMessages(msgs);
            setLoading(false);
            scrollToBottom();
        });

        return () => unsubscribe();
    }, [projectId, isOpen]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser || !projectId) return;

        setSending(true);
        try {
            await addDoc(collection(db, "projects", projectId, "chat"), {
                projectId,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || "Unknown",
                senderRole: currentUser.role,
                text: newMessage.trim(),
                createdAt: serverTimestamp()
            });
            setNewMessage("");
            scrollToBottom();
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setSending(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/20 backdrop-blur-sm z-40"
                    />

                    {/* Chat Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-4 right-4 md:bottom-8 md:right-8 w-[calc(100%-2rem)] md:w-[400px] h-[500px] max-h-[85vh] rounded-2xl border border-border bg-background shadow-2xl z-50 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                                    <MessageSquare className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground font-heading">Project Chat</h3>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Client • Admin • PM</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
                            {loading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                                    <MessageSquare className="h-12 w-12 text-muted-foreground" />
                                    <p className="text-sm font-medium text-muted-foreground">No messages yet. Start the conversation!</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isMe = msg.senderId === currentUser?.uid;
                                    const showHeader = idx === 0 || messages[idx - 1].senderId !== msg.senderId || (msg.createdAt - messages[idx - 1].createdAt > 5 * 60 * 1000);

                                    return (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            key={msg.id} 
                                            className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}
                                        >
                                            {showHeader && (
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{msg.senderName}</span>
                                                    <span className={cn(
                                                        "text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest",
                                                        msg.senderRole === 'admin' ? "bg-red-500/10 text-red-500" :
                                                        msg.senderRole === 'project_manager' ? "bg-purple-500/10 text-purple-500" :
                                                        msg.senderRole === 'client' ? "bg-emerald-500/10 text-emerald-500" :
                                                        "bg-muted text-muted-foreground"
                                                    )}>
                                                        {msg.senderRole.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={cn(
                                                "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                                                isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted/50 border border-border text-foreground rounded-tl-sm"
                                            )}>
                                                {msg.text}
                                            </div>
                                            <span className="text-[9px] font-bold text-muted-foreground mt-1 opacity-50">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </motion.div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-border bg-muted/30">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 h-12 bg-background border border-border rounded-xl px-4 text-sm focus:outline-none focus:border-primary/50 transition-all font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-all active:scale-95"
                                >
                                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
