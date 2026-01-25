"use client";

import { Comment } from "@/types/schema";
import { cn } from "@/lib/utils";

interface TimelineCommentsProps {
    duration: number;
    comments: Comment[];
    onSeek: (time: number) => void;
    hoverTime?: number | null;
}

export function TimelineComments({ duration, comments, onSeek, hoverTime }: TimelineCommentsProps) {
    if (duration === 0) return null;

    return (
        <div className="relative w-full h-4 group cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            onSeek(percent * duration);
        }}>
            {/* Background Track */}
            <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-white/20 rounded-full group-hover:h-1.5 transition-all" />

            {/* Markers */}
            {comments.map((comment) => {
                const leftPercent = (comment.timestamp / duration) * 100;
                return (
                    <div 
                        key={comment.id}
                        className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-black transform -translate-x-1/2 transition-all hover:scale-150 z-10",
                            comment.status === 'resolved' ? "bg-emerald-500" : "bg-primary"
                        )}
                        style={{ left: `${leftPercent}%` }}
                        title={`${comment.userName}: ${comment.content}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSeek(comment.timestamp);
                        }}
                    />
                );
            })}
        </div>
    );
}
