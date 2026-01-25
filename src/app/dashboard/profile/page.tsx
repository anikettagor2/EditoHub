"use client";

import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, User, Mail, Shield } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
    const { user, deleteAccount } = useAuth();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) return;
        
        setIsDeleting(true);
        try {
            await deleteAccount();
        } catch (error) {
            console.error(error);
            alert("Failed to delete account. You may need to re-login recently to perform this sensitive action.");
            setIsDeleting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-xl mx-auto py-12 px-6">
            <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
            <p className="text-muted-foreground mb-8">Manage your profile and preferences</p>

            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8 space-y-8">
                
                {/* Profile Header */}
                <div className="flex items-center gap-6">
                    <Avatar className="w-20 h-20 border-2 border-white/10">
                        <AvatarImage src={user.photoURL || undefined} />
                        <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                            {user.displayName?.[0] || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    
                    <div>
                        <h2 className="text-xl font-bold text-white">{user.displayName || "User"}</h2>
                        <p className="text-zinc-400 text-sm">Member since {new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="h-px bg-white/10" />

                {/* Info Grid */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-0.5">Email</p>
                            <p className="text-zinc-200">{user.email}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-0.5">Role</p>
                            <p className="text-zinc-200 capitalize">{user.role}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-0.5">User ID</p>
                            <p className="text-zinc-500 font-mono text-xs">{user.uid}</p>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-white/10" />

                {/* Danger Zone */}
                <div className="space-y-4 pt-2">
                    <h3 className="text-red-400 text-sm font-semibold uppercase tracking-wider">Danger Zone</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Deleting your account will remove your personal data and revoke access to all projects. 
                        This action is irreversible.
                    </p>
                    
                    <Button 
                        variant="destructive" 
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="w-full bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Account Permanently
                            </>
                        )}
                    </Button>
                </div>

            </div>
        </div>
    );
}
