/**
 * Optimized VideoPlayer Component
 * Lazy loads, caches, and handles large video files efficiently
 * Shows thumbnail first, loads video on user interaction
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Play, Loader, AlertCircle, RotateCw } from 'lucide-react';
import { useIntersectionVideo } from '@/hooks/useIntersectionVideo';
import { useVideoLoader as useVideoLoaderHook } from '@/hooks/useVideoLoader';
import { formatVideoSize } from '@/lib/firebase/getVideoUrl';

export interface VideoPlayerProps {
  /**
   * Firebase Storage path to the video
   */
  storagePath: string;

  /**
   * Video ID from Firestore
   */
  videoId?: string;

  /**
   * Thumbnail image URL
   */
  thumbnailUrl?: string;

  /**
   * Video title for accessibility
   */
  title?: string;

  /**
   * Video duration in seconds
   */
  duration?: number;

  /**
   * File size in bytes
   */
  fileSize?: number;

  /**
   * Prefer optimized version if available
   */
  preferOptimized?: boolean;

  /**
   * Use lazy loading with intersection observer
   */
  useLazyLoading?: boolean;

  /**
   * Cache duration in hours
   */
  cacheDurationHours?: number;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Show metadata overlay
   */
  showMetadata?: boolean;

  /**
   * Autoplay when visible
   */
  autoplay?: boolean;

  /**
   * Controls visibility
   */
  controls?: boolean;

  /**
   * Error callback
   */
  onError?: (error: Error) => void;

  /**
   * Success callback
   */
  onSuccess?: (url: string) => void;

  /**
   * Loading callback
   */
  onLoadingChange?: (isLoading: boolean) => void;
}

interface VideoState {
  hasStarted: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
}

/**
 * Main VideoPlayer Component
 *
 * @example
 * <VideoPlayer
 *   storagePath="videos/original/video123.mp4"
 *   videoId="video123"
 *   thumbnailUrl="https://..."
 *   title="My Video"
 *   useLazyLoading={true}
 *   showMetadata={true}
 * />
 */
export const VideoPlayer = React.forwardRef<HTMLVideoElement, VideoPlayerProps>(
  (
    {
      storagePath,
      videoId,
      thumbnailUrl,
      title = 'Video Player',
      duration: metadataDuration,
      fileSize,
      preferOptimized = true,
      useLazyLoading = true,
      cacheDurationHours = 1,
      className = '',
      showMetadata = true,
      autoplay = false,
      controls = true,
      onError,
      onSuccess,
      onLoadingChange,
    },
    forwardedRef
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [videoState, setVideoState] = useState<VideoState>({
      hasStarted: false,
      isBuffering: false,
      currentTime: 0,
      duration: metadataDuration || 0,
      buffered: 0,
    });

    // Use lazy loading or regular loader
    const videoLoader = useLazyLoading
      ? useIntersectionVideo({
          storagePath,
          videoId,
          preferOptimized,
          cacheDurationHours,
          autoLoad: false,
          preloadMetadata: true,
        }).videoLoader
      : useVideoLoaderHook({
          storagePath,
          videoId,
          preferOptimized,
          cacheDurationHours,
          autoLoad: true,
          preloadMetadata: true,
        });

    /**
     * Handle video metadata
     */
    const handleLoadedMetadata = useCallback(() => {
      if (videoRef.current) {
        setVideoState(prev => ({
          ...prev,
          duration: videoRef.current?.duration || prev.duration,
        }));
      }
    }, []);

    /**
     * Handle play button activation
     */
    const handlePlayClick = useCallback(() => {
      if (videoRef.current) {
        const playPromise = videoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Play started successfully - silent
            })
            .catch(error => {
              // Suppress AbortError - this is expected when play is interrupted
              if (error?.name === 'AbortError') {
                return;
              }
              
              if (error instanceof Error) {
                console.error('[VideoPlayer] Play error:', error.message);
                onError?.(error);
              }
            });
        }
      }
    }, [onError]);

    /**
     * Handle pause
     */
    const handlePause = useCallback(() => {
      setVideoState(prev => ({
        ...prev,
        hasStarted: false,
        isBuffering: false,
      }));
    }, []);

    /**
     * Handle play
     */
    const handlePlay = useCallback(() => {
      setVideoState(prev => ({
        ...prev,
        hasStarted: true,
      }));
      onSuccess?.(videoLoader.url || '');
    }, [videoLoader.url, onSuccess]);

    /**
     * Handle buffering
     */
    const handleWaiting = useCallback(() => {
      setVideoState(prev => ({
        ...prev,
        isBuffering: true,
      }));
      onLoadingChange?.(true);
    }, [onLoadingChange]);

    const handleCanPlay = useCallback(() => {
      setVideoState(prev => ({
        ...prev,
        isBuffering: false,
      }));
      onLoadingChange?.(false);
    }, [onLoadingChange]);

    /**
     * Handle time update
     */
    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current) {
        setVideoState(prev => ({
          ...prev,
          currentTime: videoRef.current?.currentTime || 0,
          buffered: videoRef.current?.buffered.length
            ? videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
            : 0,
        }));
      }
    }, []);

    /**
     * Handle video error
     */
    const handleVideoError = useCallback(() => {
      const error = videoRef.current?.error;
      const errorMessage =
        error?.code === 4
          ? 'Video file could not be loaded'
          : error?.code === 3
            ? 'Video loading aborted'
            : 'Error loading video';

      const err = new Error(errorMessage);
      console.error('[VideoPlayer] Video error:', err);
      onError?.(err);
    }, [onError]);

    /**
     * Handle loader error
     */
    const handleLoaderError = useCallback(() => {
      if (videoLoader.error) {
        onError?.(videoLoader.error);
      }
    }, [videoLoader.error, onError]);

    // Notify parent of loading changes
    useEffect(() => {
      onLoadingChange?.(videoLoader.isLoading);
    }, [videoLoader.isLoading, onLoadingChange]);

    // Handle loader errors
    useEffect(() => {
      if (videoLoader.error) {
        handleLoaderError();
      }
    }, [videoLoader.error, handleLoaderError]);

    // Expose video ref
    useEffect(() => {
      if (forwardedRef) {
        if (typeof forwardedRef === 'function') {
          forwardedRef(videoRef.current);
        } else {
          forwardedRef.current = videoRef.current;
        }
      }
    }, [forwardedRef]);

    const percentage = videoState.duration
      ? (videoState.currentTime / videoState.duration) * 100
      : 0;

    return (
      <div
        ref={containerRef}
        className={`relative w-full bg-black rounded-lg overflow-hidden group ${className}`}
        data-video-player
      >
        {/* Thumbnail/Poster */}
        {!videoState.hasStarted && thumbnailUrl && (
          <div className="absolute inset-0 z-10">
            <Image
              src={thumbnailUrl}
              alt={title}
              fill
              className="object-cover w-full h-full"
              priority
            />
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-full"
          preload="metadata"
          poster={thumbnailUrl}
          controls={controls && videoState.hasStarted}
          autoPlay={autoplay}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          onError={handleVideoError}
        >
          {videoLoader.url && <source src={videoLoader.url} type="video/mp4" />}
          Your browser does not support the video tag.
        </video>

        {/* Loading State */}
        {videoLoader.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
            <div className="flex flex-col items-center gap-2">
              <Loader className="w-8 h-8 text-white animate-spin" />
              <p className="text-white text-sm">Loading video...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {videoLoader.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-white text-sm text-center max-w-xs">
                Failed to load video
              </p>
              <button
                onClick={() => videoLoader.retry()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Play Button Overlay */}
        {!videoState.hasStarted && !videoLoader.isLoading && !videoLoader.error && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors cursor-pointer z-15 group-hover:bg-black/50"
            onClick={handlePlayClick}
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
              <Play className="w-8 h-8 text-black ml-1" fill="black" />
            </div>
          </div>
        )}

        {/* Buffering Indicator */}
        {videoState.isBuffering && videoState.hasStarted && (
          <div className="absolute top-4 right-4 z-20">
            <Loader className="w-6 h-6 text-white animate-spin" />
          </div>
        )}

        {/* Progress Bar */}
        {videoState.hasStarted && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 group-hover:h-2 transition-all">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}

        {/* Metadata Overlay */}
        {showMetadata && (
          <div className="absolute bottom-4 left-4 right-4 z-15">
            <div className="bg-black/60 text-white p-3 rounded-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-sm font-semibold">{title}</p>
              <div className="flex justify-between text-xs mt-2 text-gray-300">
                <span>
                  {Math.floor(videoState.currentTime / 60)}:
                  {String(Math.floor(videoState.currentTime % 60)).padStart(2, '0')} /
                  {metadataDuration
                    ? ` ${Math.floor(metadataDuration / 60)}:${String(Math.floor(metadataDuration % 60)).padStart(2, '0')}`
                    : ''}
                </span>
                {fileSize && <span>{formatVideoSize(fileSize)}</span>}
                {videoLoader.isOptimized && <span className="text-blue-400">Optimized</span>}
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator in Top Left */}
        {videoLoader.wasCached && (
          <div className="absolute top-4 left-4 bg-green-600/80 text-white px-2 py-1 rounded text-xs z-20 hidden group-hover:block">
            ✓ Cached
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
