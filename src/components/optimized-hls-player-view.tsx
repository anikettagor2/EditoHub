"use client";

import { OptimizedHLSPlayer } from "@/components/optimized-hls-player";
import { OptimizedVideoPlayer } from "@/components/optimized-video-player";
import { useVideoPreload } from "@/lib/streaming/video-preload";

// ---------------------------------------------------------------------------
// OptimizedHLSPlayerView - Smart Video Player for Review Systems
//
// DISPLAY LOGIC (Review/Guest Systems Only):
// 1. Priority: hlsUrl (adaptive segmented playback) > proxyUrl (low-quality MP4)
// 2. Use HLS for segmented low-buffer playback and quality switching
// 3. Do not load raw Firebase storage videoUrl for preview playback
//
// DOWNLOAD LOGIC (Always High Quality):
// - Downloads use the original videoUrl from revision document
// - Optimized/proxy versions are for review-only playback
// ---------------------------------------------------------------------------

interface OptimizedHLSPlayerViewProps {
  hlsUrl?: string;
  videoUrl?: string;
  proxyUrl?: string; // Low-quality MP4 proxy for raw footage display only
  projectName: string;
  fileSize?: number;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onError?: (error: Error) => void;
}

export function OptimizedHLSPlayerView({
  hlsUrl,
  proxyUrl,
  projectName,
  fileSize,
  onTimeUpdate,
  onError,
}: OptimizedHLSPlayerViewProps) {
  const isLargeVideo = fileSize && fileSize > 50 * 1024 * 1024;
  const { isPreloading } = useVideoPreload(hlsUrl || proxyUrl || "", true);

  if (hlsUrl) {
    return (
      <OptimizedHLSPlayer
        hlsUrl={hlsUrl}
        projectName={projectName}
        fileSize={fileSize}
        autoPlay={false}
        speedFirst={true} // Prioritize speed above all else
        preload="auto" // More aggressive preloading
        onTimeUpdate={onTimeUpdate}
        onError={onError}
        className="w-full h-full"
      />
    );
  }

  if (proxyUrl) {
    return (
      <OptimizedVideoPlayer
        videoPath={proxyUrl}
        title={projectName}
        onTimeUpdate={onTimeUpdate}
        className="w-full h-full"
        onError={onError}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black text-sm text-muted-foreground p-6">
      <div className="text-center space-y-2">
        <p className="font-semibold">Preview unavailable</p>
        <p className="text-[13px] text-muted-foreground">The low-quality review stream is still being generated. Please check back shortly.</p>
      </div>
    </div>
  );
}
