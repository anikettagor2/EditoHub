"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import Hls from "hls.js";

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
    const hlsRef = useRef<Hls | null>(null);

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

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;

      // Cleanup previous hls instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const isHls = src.endsWith(".m3u8");
      if (!isHls) {
        video.src = src;
        return;
      }

      // Native HLS (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        return;
      }

      // hls.js fallback (Chrome/Firefox/Edge)
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        // Final fallback
        video.src = src;
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [src]);

    return (
      <video 
        ref={videoRef}
        controls 
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full object-contain"
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
