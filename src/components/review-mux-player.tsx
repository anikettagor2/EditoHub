"use client";

import dynamic from "next/dynamic";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
});

interface ReviewMuxPlayerProps {
  playbackId?: string;
  videoPath?: string;
  title?: string;
  className?: string;
  metadata?: Record<string, unknown>;
  primaryColor?: string;
  playbackRates?: number[];
  forwardSeekOffset?: number;
  backwardSeekOffset?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onPlaying?: () => void;
  onPause?: () => void;
}

function extractMuxPlaybackId(videoPath?: string): string | undefined {
  if (!videoPath) return undefined;
  const match = videoPath.match(/https?:\/\/stream\.mux\.com\/([^./?]+)(?:\.[^/?]+)?/i);
  return match?.[1];
}

export function ReviewMuxPlayer({
  playbackId,
  videoPath,
  title,
  className,
  metadata,
  primaryColor = "#ffffff",
  playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2],
  forwardSeekOffset = 10,
  backwardSeekOffset = 10,
  onTimeUpdate,
  onLoadedMetadata,
  onPlaying,
  onPause,
}: ReviewMuxPlayerProps) {
  const [error, setError] = useState<string | null>(null);
  const resolvedPlaybackId = useMemo(
    () => playbackId || extractMuxPlaybackId(videoPath),
    [playbackId, videoPath]
  );

  useEffect(() => {
    if (resolvedPlaybackId) {
      console.info("[ReviewMuxPlayer] playbackId resolved:", resolvedPlaybackId);
    } else {
      console.warn("[ReviewMuxPlayer] Missing playbackId. Waiting for Mux asset readiness.", {
        hasVideoPath: Boolean(videoPath),
      });
    }
  }, [resolvedPlaybackId, videoPath]);

  if (!resolvedPlaybackId) {
    return (
      <div className={cn("relative w-full aspect-video bg-black rounded-lg overflow-hidden", className)}>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Loading video...
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full aspect-video bg-black rounded-lg overflow-hidden", className)}>
      <MuxPlayer
        playbackId={resolvedPlaybackId}
        metadata={{
          video_title: title,
          ...metadata,
        }}
        streamType="on-demand"
        style={{ width: "100%", height: "100%", aspectRatio: "16/9" }}
        autoPlay={false}
        controls
        playsInline
        muted={false}
        preload="auto"
        onPlay={onPlaying}
        onPause={onPause}
        onTimeUpdate={(e) => {
          const video = e.target as HTMLVideoElement;
          if (video) onTimeUpdate?.(video.currentTime, video.duration);
        }}
        onLoadedMetadata={(e) => {
          const video = e.target as HTMLVideoElement;
          if (video) onLoadedMetadata?.(video.duration);
        }}
        onError={() => {
          setError("Failed to load Mux stream");
        }}
        primaryColor={primaryColor}
        accentColor={primaryColor}
        playbackRates={playbackRates}
        forwardSeekOffset={forwardSeekOffset}
        backwardSeekOffset={backwardSeekOffset}
        className="w-full h-full"
      />

      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-xs text-white font-bold">{error}</p>
        </div>
      )}
    </div>
  );
}
