"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GuestIdentityModalProps {
    isOpen: boolean;
    onIdentify: (name: string, email: string) => void;
    onClose?: () => void; // Optional if we want to force it
}

export function GuestIdentityModal({ isOpen, onIdentify, onClose }: GuestIdentityModalProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        
        setIsLoading(true);
        // Simulate a small delay or validation if needed
        setTimeout(() => {
            onIdentify(name, email);
            setIsLoading(false);
        }, 500);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                // Prevent closing if strict, otherwise call onClose
                if (onClose) onClose();
            }}
            title="Guest Reviewer"
        >
            <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                    Please enter your name to start leaving comments on this project.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                         <Label htmlFor="guest-name">Name <span className="text-red-500">*</span></Label>
                         <Input 
                            id="guest-name"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="bg-black/40 border-white/10"
                         />
                    </div>
                    <div className="space-y-2">
                         <Label htmlFor="guest-email">Email (Optional)</Label>
                         <Input 
                            id="guest-email"
                            type="email"
                            placeholder="john@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-black/40 border-white/10"
                         />
                         <p className="text-xs text-zinc-500">Used only to notify you of replies.</p>
                    </div>

                    <div className="pt-2 flex justify-end">
                        <Button 
                            type="submit" 
                            disabled={!name.trim() || isLoading}
                            className="w-full bg-primary hover:bg-primary/90 text-white"
                        >
                            {isLoading ? "Joining..." : "Start Reviewing"}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
