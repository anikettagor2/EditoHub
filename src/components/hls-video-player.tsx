"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";

interface HlsVideoPlayerProps {
    src: string;
    poster?: string;
    className?: string;
    autoPlay?: boolean;
}

/**
 * Cross-browser HLS player.
 * - Uses native HLS on Safari (and iOS).
 * - Falls back to hls.js (MSE) on Chrome / Firefox.
 * - Falls back to plain <video> src for non-HLS URLs (regular MP4, etc.).
 */
export function HlsVideoPlayer({ src, poster, className, autoPlay = false }: HlsVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = auto

    const isHlsUrl = src.endsWith(".m3u8");

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        setError(null);

        // Cleanup any previous instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        if (!isHlsUrl) {
            // Plain video — just set src directly
            video.src = src;
            return;
        }

        // Native HLS (Safari)
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = src;
            return;
        }

        // hls.js
        if (Hls.isSupported()) {
            const hls = new Hls({ autoStartLoad: true, startLevel: -1 });
            hlsRef.current = hls;
            hls.attachMedia(video);
            hls.loadSource(src);

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                const available = data.levels.map((l, i) => ({ height: l.height, index: i }));
                setLevels(available);
                if (autoPlay) video.play().catch(() => {});
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                setCurrentLevel(data.level);
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    setError("Video playback error. Please try again.");
                    hls.destroy();
                }
            });
        } else {
            setError("HLS playback is not supported in this browser.");
        }

        return () => {
            hlsRef.current?.destroy();
            hlsRef.current = null;
        };
    }, [src, isHlsUrl, autoPlay]);

    const switchLevel = (level: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = level;
            setCurrentLevel(level);
        }
    };

    return (
        <div className={cn("relative group", className)}>
            <video
                ref={videoRef}
                poster={poster}
                controls
                playsInline
                autoPlay={autoPlay && !isHlsUrl} // hls.js handles autoPlay internally
                className="w-full h-full rounded-inherit object-contain bg-black"
            />

            {/* Quality selector — only shown for HLS streams with multiple levels */}
            {isHlsUrl && levels.length > 1 && (
                <div className="absolute bottom-12 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <select
                        className="bg-black/80 text-white text-xs rounded px-2 py-1 border border-white/20 cursor-pointer"
                        value={currentLevel}
                        onChange={(e) => switchLevel(Number(e.target.value))}
                    >
                        <option value={-1}>Auto</option>
                        {levels.map(({ height, index }) => (
                            <option key={index} value={index}>
                                {height}p
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-inherit">
                    <p className="text-red-400 text-sm font-bold px-4 text-center">{error}</p>
                </div>
            )}
        </div>
    );
}
