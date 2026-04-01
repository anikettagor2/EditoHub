"use client";

import { useRef, useState, useEffect } from 'react';
import { Play, Pause, VolumeX, Volume2, Maximize } from 'lucide-react';
import HLS from 'hls.js';

interface AdaptiveVideoPlayerProps {
  src?: string;
  hlsUrl?: string;
  videoUrl?: string;
  projectName?: string;
  onTimeUpdate?: (currentTime: number, duration?: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlaying?: () => void;
  onPause?: () => void;
  onCanPlay?: () => void;
  onWaiting?: () => void;
  onCanPlayThrough?: () => void;
  onStalled?: () => void;
  onError?: (error: any) => void;
  title?: string;
  className?: string;
}

export function AdaptiveVideoPlayer({
  src,
  hlsUrl,
  videoUrl,
  projectName,
  onTimeUpdate,
  onDurationChange,
  onPlaying,
  onPause,
  onCanPlay,
  onWaiting,
  onCanPlayThrough,
  onStalled,
  onError,
  className = '',
}: AdaptiveVideoPlayerProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Use provided URL - prioritize videoUrl, then src, then hlsUrl
  const finalUrl = videoUrl || src || hlsUrl;

  // Debug logging
  useEffect(() => {
    console.log('[AdaptiveVideoPlayer] Loading video with URL:', finalUrl);
  }, [finalUrl]);

  // Handle HLS streams
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsUrl && HLS.isSupported()) {
      const hls = new HLS({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(HLS.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('[AdaptiveVideoPlayer] HLS Error:', {
            type: data.type,
            details: data.details,
            error: data.error,
          });
          switch (data.type) {
            case HLS.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case HLS.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              break;
          }
        }
      });

      return () => {
        hls.destroy();
      };
    }
  }, [hlsUrl]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current != null) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!finalUrl) {
    return (
      <div className={`relative w-full bg-black aspect-video rounded-xl overflow-hidden flex items-center justify-center ${className}`}>
        <div className="text-center text-white space-y-2">
          <p className="text-sm font-semibold">Preparing video...</p>
          <p className="text-xs text-gray-400">Video is being transcoded for streaming. This may take a few moments.</p>
          <div className="flex justify-center mt-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black aspect-video rounded-xl overflow-hidden group ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        preload="metadata"
        src={hlsUrl && HLS.isSupported() ? undefined : finalUrl}
        onPlay={() => {
          setIsPlaying(true);
          onPlaying?.();
        }}
        onPause={() => {
          setIsPlaying(false);
          onPause?.();
        }}
        onTimeUpdate={() => {
          const time = videoRef.current?.currentTime || 0;
          setCurrentTime(time);
          onTimeUpdate?.(time, duration);
        }}
        onDurationChange={() => {
          const dur = videoRef.current?.duration || 0;
          setDuration(dur);
          onDurationChange?.(dur);
        }}
        onLoadedMetadata={() => onCanPlay?.()}
        onCanPlay={() => onCanPlayThrough?.()}
        onWaiting={() => onWaiting?.()}
        onStalled={() => onStalled?.()}
        onError={(e) => {
          const errorCode = (e.target as HTMLVideoElement).error?.code;
          const errorMessage = (e.target as HTMLVideoElement).error?.message;
          console.error('[AdaptiveVideoPlayer] Error:', {
            code: errorCode,
            message: errorMessage,
            videoSrc: finalUrl,
            eventError: e,
          });
          onError?.(e);
        }}
      />

      {/* Play Button Overlay */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition z-10"
        >
          <div className="bg-white/20 hover:bg-white/30 rounded-full p-6 transition">
            <Play className="h-16 w-16 text-white fill-white" />
          </div>
        </button>
      )}

      {/* Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-gray-600 rounded cursor-pointer mb-3"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
              duration ? (currentTime / duration) * 100 : 0
            }%, rgb(75, 85, 99) ${duration ? (currentTime / duration) * 100 : 0}%, rgb(75, 85, 99) 100%)`,
          }}
        />

        {/* Bottom Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-blue-400 transition">
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white hover:text-blue-400 transition">
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-gray-600 rounded cursor-pointer"
              />
            </div>

            {/* Time */}
            <span className="text-xs text-white/70 font-mono ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white hover:text-blue-400 transition">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
