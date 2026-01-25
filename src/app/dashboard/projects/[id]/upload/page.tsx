"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { db, storage } from "@/lib/firebase/config";
import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot, StorageError } from "firebase/storage";
import { collection, addDoc, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { Revision } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; 
import { Loader2, ArrowLeft, UploadCloud, FileVideo } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function UploadRevisionPage() {
    const params = useParams();
    const id = params?.id as string;
    const { user } = useAuth();
    const router = useRouter();
    
    const [file, setFile] = useState<File | null>(null);
    const [description, setDescription] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !user || typeof id !== 'string') return;

        // validation
        if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB limit
             alert("File is too large. Max size is 2GB.");
             return;
        }

        setIsUploading(true);
        setProgress(0);

        try {
            // 1. Get latest version number
            const q = query(
                collection(db, "revisions"),
                where("projectId", "==", id),
                orderBy("version", "desc"),
                limit(1)
            );
            const snap = await getDocs(q);
            let nextVersion = 1;
            if (!snap.empty) {
                const latest = snap.docs[0].data() as Revision;
                nextVersion = latest.version + 1;
            }

            // 2. Upload File to Storage (Resumable Upload)
            const storageRef = ref(storage, `projects/${id}/v${nextVersion}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                (snapshot: UploadTaskSnapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(progress);
                }, 
                (error: StorageError) => {
                    console.error("Upload failed:", error);
                    setIsUploading(false);
                    if (error.code === 'storage/unauthorized') {
                         alert("Permission denied. content-type or size might be an issue, or you are not logged in.");
                    } else {
                         alert(`Upload failed: ${error.message || "Network Error"}`);
                    }
                }, 
                async () => {
                    // 3. Upload Complete - Get URL & Create Doc
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                        const newRevision: Omit<Revision, "id"> = {
                            projectId: id,
                            version: nextVersion,
                            videoUrl: downloadURL,
                            status: 'active',
                            uploadedBy: user.uid,
                            createdAt: Date.now(),
                            description: description
                        };
            
                        await addDoc(collection(db, "revisions"), newRevision);
                        
                        setIsUploading(false);
                        // Redirect
                        router.push(`/dashboard/projects/${id}`);
                    } catch (dbError) {
                         console.error("Error saving revision:", dbError);
                         setIsUploading(false);
                         alert("Upload finished but failed to save record. Contact support.");
                    }
                }
            );

        } catch (error: any) {
            console.error("Error starting upload:", error);
            setIsUploading(false);
            alert(`Failed to start upload: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <div className="w-full max-w-xl space-y-6">
                 <Link 
                    href={`/dashboard/projects/${id}`} 
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Project
                </Link>

                <div>
                    <h1 className="text-3xl font-bold">Upload New Version</h1>
                    <p className="text-muted-foreground mt-2">
                        Upload the latest video file for client review.
                    </p>
                </div>

                <form onSubmit={handleUpload} className="space-y-6 rounded-2xl border border-white/10 bg-zinc-900/50 p-8 backdrop-blur-sm">
                    
                    {/* Drag & Drop Area (simplified as styled input) */}
                    <div className="space-y-2">
                        <Label>Video File</Label>
                        <div className={cn(
                            "relative border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all hover:border-primary/50 hover:bg-zinc-900/80 cursor-pointer",
                            file ? "border-primary bg-primary/5" : ""
                        )}>
                            <input 
                                type="file" 
                                accept="video/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                                required
                            />
                            {file ? (
                                <div className="space-y-2">
                                    <FileVideo className="h-10 w-10 text-primary mx-auto" />
                                    <p className="font-medium text-white">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto" />
                                    <p className="font-medium text-white">Click or Drag video here</p>
                                    <p className="text-xs text-muted-foreground">MP4, MOV, WebM up to 2GB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Version Notes</Label>
                        <Textarea 
                            id="description" 
                            placeholder="What changed in this version?"
                            className="bg-black/40 border-white/10 text-white"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {isUploading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Uploading...</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <Button 
                        type="submit" 
                        disabled={!file || isUploading}
                        className="w-full bg-primary text-white hover:bg-primary/90 py-6 text-lg shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                    >
                        {isUploading ? (
                             <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Processing Upload...
                            </>
                        ) : "Upload Version"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
