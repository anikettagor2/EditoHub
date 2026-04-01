/**
 * Enhanced VideoPlayer Component with Adaptive Quality
 * Automatically loads optimized quality based on device and bandwidth
 * Supports quality upgrades during playback
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Play, Loader, AlertCircle, RotateCw, Zap } from 'lucide-react';
import { useIntersectionVideo } from '@/hooks/useIntersectionVideo';
import { useAdaptiveVideo, useQualityMonitoring } from '@/hooks/useAdaptiveVideo';
import { formatVideoSize } from '@/lib/firebase/getVideoUrl';
import type { AdaptiveVideoUrlOptions } from '@/lib/firebase/adaptiveVideoLoader';

export interface AdaptiveVideoPlayerProps extends Omit<AdaptiveVideoUrlOptions, 'videoId' | 'storagePath'> {
  /**
   * Firebase Storage path to the video (original quality)
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
   * Use lazy loading with intersection observer
   */
  useLazyLoading?: boolean;

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
   * Custom className
   */
  className?: string;

  /**
   * Show quality selector
   */
  showQualitySelector?: boolean;

  /**
   * Error callback
   */
  onError?: (error: Error) => void;

  /**
   * Success callback
   */
  onSuccess?: (url: string, quality: string) => void;

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
 * Adaptive VideoPlayer Component
 * 
 * @example
 * <AdaptiveVideoPlayer
 *   storagePath="videos/original/video.mp4"
 *   videoId="video123"
 *   thumbnailUrl="https://..."
 *   title="My Video"
 *   useAdaptiveQuality={true}
 *   showQualitySelector={true}
 * />
 */
export const AdaptiveVideoPlayer = React.forwardRef<HTMLVideoElement, AdaptiveVideoPlayerProps>(
  (
    {
      storagePath,
      videoId = `video_${Date.now()}`,
      thumbnailUrl,
      title = 'Video Player',
      duration: metadataDuration,
      fileSize,
      useAdaptiveQuality = true,
      useLazyLoading = true,
      cacheDurationHours = 1,
      className = '',
      showMetadata = true,
      autoplay = false,
      controls = true,
      showQualitySelector = true,
      onError,
      onSuccess,
      onLoadingChange,
      metadata: metadataOption,
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

    const [selectedQuality, setSelectedQuality] = useState<string>('360p');

    // Use adaptive video loader
    const adaptiveLoader = useAdaptiveVideo({
      videoId,
      storagePath,
      useAdaptiveQuality,
      cacheDurationHours,
      metadata: metadataOption,
    });

    // Monitor quality during playback
    useQualityMonitoring(videoRef as any, adaptiveLoader.canUpgrade, adaptiveLoader.url || '');

    /**
     * Handle metadata loaded
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
     * Handle play
     */
    const handlePlayClick = useCallback(() => {
      if (videoRef.current) {
        const playPromise = videoRef.current.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Play started successfully - no console spam
            })
            .catch(error => {
              // Suppress AbortError - expected when play is interrupted by pause()
              if (error?.name === 'AbortError') {
                return;
              }

              console.error('[AdaptiveVideoPlayer] Play error:', error?.message || error);
              onError?.(error instanceof Error ? error : new Error(String(error)));
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
     * Handle play event
     */
    const handlePlay = useCallback(() => {
      setVideoState(prev => ({
        ...prev,
        hasStarted: true,
      }));
      onSuccess?.(adaptiveLoader.url || '', adaptiveLoader.quality);
    }, [adaptiveLoader.url, adaptiveLoader.quality, onSuccess]);

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
     * Handle quality upgrade
     */
    const handleUpgradeQuality = useCallback(async () => {
      if (adaptiveLoader.canUpgrade) {
        const upgraded = await adaptiveLoader.upgradeQuality(videoRef.current);
        if (upgraded) {
          setSelectedQuality('Higher');
          console.log('[AdaptiveVideoPlayer] Quality upgraded');
        }
      }
    }, [adaptiveLoader]);

    /**
     * Expose ref
     */
    useEffect(() => {
      if (forwardedRef) {
        if (typeof forwardedRef === 'function') {
          forwardedRef(videoRef.current);
        } else {
          forwardedRef.current = videoRef.current;
        }
      }
    }, [forwardedRef]);

    // Notify loading state
    useEffect(() => {
      onLoadingChange?.(adaptiveLoader.isLoading);
    }, [adaptiveLoader.isLoading, onLoadingChange]);

    // Handle errors
    useEffect(() => {
      if (adaptiveLoader.error) {
        onError?.(adaptiveLoader.error);
      }
    }, [adaptiveLoader.error, onError]);

    const percentage = videoState.duration
      ? (videoState.currentTime / videoState.duration) * 100
      : 0;

    if (useLazyLoading) {
      // Implement lazy loading version later
      // For now, use regular version
    }

    return (
      <div
        ref={containerRef}
        className={`relative w-full bg-black rounded-lg overflow-hidden group ${className}`}
        data-adaptive-video-player
      >
        {/* Thumbnail */}
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
        >
          {adaptiveLoader.url && (
            <source src={adaptiveLoader.url} type="video/mp4" />
          )}
          Your browser does not support the video tag.
        </video>

        {/* Loading State */}
        {adaptiveLoader.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
            <div className="flex flex-col items-center gap-2">
              <Loader className="w-8 h-8 text-white animate-spin" />
              <p className="text-white text-sm">
                Loading {adaptiveLoader.quality}...
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {adaptiveLoader.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-white text-sm text-center max-w-xs">
                {adaptiveLoader.error.message}
              </p>
              <button
                onClick={() => adaptiveLoader.load()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Play Button */}
        {!videoState.hasStarted &&
          !adaptiveLoader.isLoading &&
          !adaptiveLoader.error && (
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
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-semibold flex-1">{title}</p>
                {adaptiveLoader.canUpgrade && showQualitySelector && (
                  <button
                    onClick={handleUpgradeQuality}
                    className="ml-2 px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition flex items-center gap-1 whitespace-nowrap"
                  >
                    <Zap className="w-3 h-3" />
                    Upgrade HD
                  </button>
                )}
              </div>

              <div className="flex justify-between text-xs mt-2 text-gray-300">
                <span>
                  {Math.floor(videoState.currentTime / 60)}:
                  {String(Math.floor(videoState.currentTime % 60)).padStart(
                    2,
                    '0'
                  )}{' '}
                  /
                  {metadataDuration
                    ? ` ${Math.floor(metadataDuration / 60)}:${String(
                      Math.floor(metadataDuration % 60)
                    ).padStart(2, '0')}`
                    : ''}
                </span>
                <div className="flex gap-3">
                  {fileSize && <span>{formatVideoSize(fileSize)}</span>}
                  <span
                    className={`${
                      adaptiveLoader.quality === '360p'
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    {adaptiveLoader.quality}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quality Badge */}
        <div className="absolute top-4 left-4 bg-blue-600/80 text-white px-2 py-1 rounded text-xs z-20 hidden group-hover:block">
          {adaptiveLoader.quality} • {adaptiveLoader.isLoading ? 'Loading...' : 'Ready'}
        </div>
      </div>
    );
  }
);

AdaptiveVideoPlayer.displayName = 'AdaptiveVideoPlayer';

export default AdaptiveVideoPlayer;
