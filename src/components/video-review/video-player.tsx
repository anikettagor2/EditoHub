"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
  pause: () => void;
  play: () => void;
}

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ src, onTimeUpdate, onDurationChange }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      pause: () => {
        videoRef.current?.pause();
      },
      play: () => {
        videoRef.current?.play();
      }
    }));

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            onTimeUpdate?.(video.currentTime);
        };

        const handleLoadedMetadata = () => {
            onDurationChange?.(video.duration);
        };

        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("loadedmetadata", handleLoadedMetadata);

        return () => {
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        };
    }, [onTimeUpdate, onDurationChange]);

    return (
      <video 
        ref={videoRef}
        src={src} 
        controls 
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full object-contain"
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
