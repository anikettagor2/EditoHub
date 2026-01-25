"use client";

import { useEffect, useState, useRef } from "react";
import { db, storage } from "@/lib/firebase/config";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Smile, Paperclip, MoreVertical, X, Mic, Trash2, StopCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  type: 'text' | 'image' | 'system' | 'audio';
  audioUrl?: string; // For voice notes
}

interface ProjectChatProps {
    projectId: string;
    currentUser: any;
    assignedEditorId?: string;
}

export function ProjectChat({ projectId, currentUser, assignedEditorId }: ProjectChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [editor, setEditor] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    
    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch Editor Details
    useEffect(() => {
        if (!assignedEditorId) return;
        async function fetchEditor() {
             const userDoc = await getDoc(doc(db, "users", assignedEditorId!));
             if (userDoc.exists()) {
                 setEditor(userDoc.data());
             }
        }
        fetchEditor();
    }, [assignedEditorId]);

    // Real-time Messages
    useEffect(() => {
        if (!projectId) return;

        const q = query(
            collection(db, "projects", projectId, "messages"),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Message[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                msgs.push({ 
                    id: doc.id,
                    text: data.text || "",
                    senderId: data.senderId,
                    senderName: data.senderName,
                    timestamp: data.timestamp,
                    type: data.type || 'text',
                    audioUrl: data.audioUrl
                 } as Message);
            });
            setMessages(msgs);
            // Scroll to bottom
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [projectId]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await addDoc(collection(db, "projects", projectId, "messages"), {
                text: newMessage,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || "Unknown",
                timestamp: serverTimestamp(),
                type: 'text'
            });
            setNewMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            
            // Start Timer
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Could not access microphone. Please allow permissions.");
        }
    };

    const stopRecording = (cancel = false) => {
        if (!mediaRecorderRef.current) return;

        mediaRecorderRef.current.onstop = async () => {
            if (!cancel) {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await uploadAudio(audioBlob);
            }
            // Cleanup stream tracks
            const tracks = mediaRecorderRef.current?.stream.getTracks();
            tracks?.forEach(track => track.stop());
        };

        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);
    };

    const uploadAudio = async (blob: Blob) => {
        const toastId = toast.loading("Sending voice note...");
        try {
            const fileId = uuidv4();
            const storageRef = ref(storage, `chat-voice-notes/${projectId}/${fileId}.webm`);
            await uploadBytes(storageRef, blob);
            const downloadUrl = await getDownloadURL(storageRef);

            await addDoc(collection(db, "projects", projectId, "messages"), {
                text: "Voice Note", // Fallback text
                senderId: currentUser.uid,
                senderName: currentUser.displayName || "Unknown",
                timestamp: serverTimestamp(),
                type: 'audio',
                audioUrl: downloadUrl
            });
            
            toast.dismiss(toastId);
        } catch (error) {
            console.error("Upload failed", error);
            toast.error("Failed to send voice note", { id: toastId });
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ... (keep header logic) ...

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-10 w-10 ring-2 ring-zinc-800">
                            {editor ? (
                                <>
                                    <AvatarImage src={editor.photoURL} />
                                    <AvatarFallback className="bg-primary/20 text-primary">
                                        {editor.displayName?.substring(0,2).toUpperCase()}
                                    </AvatarFallback>
                                </>
                            ) : (
                                <AvatarFallback className="bg-zinc-800 text-zinc-400">
                                    <MoreVertical className="h-5 w-5" />
                                </AvatarFallback>
                            )}
                        </Avatar>
                        {editor && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-black" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-zinc-100">
                            {editor ? editor.displayName : "Project Team"}
                        </h3>
                        {editor ? (
                             <p className="text-[10px] text-emerald-500 font-medium">Online</p>
                        ) : (
                             <p className="text-[10px] text-zinc-500">General Channel</p>
                        )}
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                 {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2">
                        <div className="h-12 w-12 rounded-full bg-zinc-900 flex items-center justify-center mb-2">
                            <Smile className="h-6 w-6 opacity-50" />
                        </div>
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs">Start the conversation!</p>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== msg.senderId);

                    return (
                        <div key={msg.id} className={cn("flex gap-3", isMe ? "justify-end" : "justify-start")}>
                            {!isMe && (
                                <div className="w-8 flex-shrink-0 flex flex-col items-center">
                                    {showAvatar ? (
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400">
                                                {msg.senderName.substring(0,1)}
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : <div className="w-8" />}
                                </div>
                            )}
                            
                            <div className={cn(
                                "max-w-[75%] space-y-1",
                                isMe ? "items-end" : "items-start"
                            )}>
                                <div className={cn(
                                    "px-4 py-3 text-sm leading-relaxed shadow-sm relative group",
                                    isMe 
                                        ? "bg-primary text-white rounded-2xl rounded-tr-none" 
                                        : "bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-none",
                                    msg.type === 'audio' && "min-w-[200px]"
                                )}>
                                    {msg.type === 'audio' ? (
                                        <div className="flex items-center gap-2">
                                            <audio controls className="h-8 w-full max-w-[240px] rounded" src={msg.audioUrl} />
                                        </div>
                                    ) : (
                                        msg.text
                                    )}
                                    <span className={cn(
                                        "text-[9px] absolute bottom-1 opacity-0 group-hover:opacity-70 transition-opacity",
                                        isMe ? "right-full mr-2 text-zinc-500" : "left-full ml-2 text-zinc-500"
                                    )}>
                                         {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                {isRecording ? (
                    <div className="flex items-center gap-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-2 px-4 h-14 animate-in fade-in slide-in-from-bottom-2">
                         <div className="flex items-center gap-3 flex-1">
                             <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                             </span>
                             <span className="text-red-400 font-mono font-bold w-12">{formatTime(recordingTime)}</span>
                             <span className="text-xs text-red-500/50 uppercase tracking-widest font-bold">Recording...</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <Button 
                                onClick={() => stopRecording(true)}
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 rounded-full hover:bg-red-500/20 text-red-400"
                             >
                                <Trash2 className="h-4 w-4" />
                             </Button>
                             <Button 
                                onClick={() => stopRecording(false)}
                                size="sm" 
                                className="h-8 px-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-xs"
                             >
                                Send <Send className="h-3 w-3 ml-2" />
                             </Button>
                         </div>
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex items-end gap-2 relative">
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800">
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        
                        <div className="flex-1 relative bg-black/50 rounded-2xl border border-zinc-800 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                            <Input 
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="bg-transparent border-none h-11 focus-visible:ring-0 text-sm px-4 pr-20"
                            />
                            <div className="absolute right-1 top-1 flex items-center gap-1 h-9">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-zinc-500 hover:text-zinc-300 rounded-full"
                                >
                                    <Smile className="h-5 w-5" />
                                </Button>
                                <Button 
                                    type="button" 
                                    onClick={startRecording}
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                                >
                                    <Mic className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            disabled={!newMessage.trim()}
                            className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 p-0 flex items-center justify-center shrink-0"
                        >
                            <Send className="h-5 w-5 ml-0.5 text-white" />
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}
