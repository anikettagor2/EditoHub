'use client';

/**
 * Enhanced Adaptive Video Player
 * Wraps the VideoPlayer component to add adaptive streaming capabilities
 * Maintains full compatibility with existing VideoPlayer API
 */

import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import AdaptiveStreamingManager from '@/lib/streaming/adaptive-streaming-manager';
import { HLSQuality } from '@/lib/streaming/hls-quality-manager';

interface AdaptiveVideoPlayerProps {
  src: string;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onQualityChange?: (quality: HLSQuality) => void;
  onNetworkStateChange?: (state: 'good' | 'fair' | 'poor') => void;
  autoQuality?: boolean;
  sourceResolution?: string;
  videoElement?: HTMLVideoElement;
}

export interface AdaptiveVideoPlayerRef {
  seekTo: (time: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  getCurrentQuality: () => HLSQuality | null;
  setQuality: (quality: HLSQuality) => void;
  getAvailableQualities: () => HLSQuality[];
  getNetworkMetrics: () => any;
  getAnalytics: () => any;
}

/**
 * AdaptiveVideoPlayer Component
 * Provides adaptive streaming with quality selection while maintaining VideoPlayer compatibility
 */
const AdaptiveVideoPlayer = forwardRef<AdaptiveVideoPlayerRef, AdaptiveVideoPlayerProps>(
  (
    {
      src,
      onTimeUpdate,
      onDurationChange,
      onQualityChange,
      onNetworkStateChange,
      autoQuality = true,
      sourceResolution = '1080p',
      videoElement: externalVideoElement,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);
    const managerRef = useRef<AdaptiveStreamingManager | null>(null);
    const [currentQuality, setCurrentQuality] = useState<HLSQuality | null>(null);
    const [availableQualities, setAvailableQualities] = useState<HLSQuality[]>([]);
    const [isHLS, setIsHLS] = useState(false);

    /**
     * Initialize adaptive streaming manager
     */
    useEffect(() => {
      if (!src) return;

      // Determine if source is HLS (more reliable check)
      const hlsUrl = (src && (src.includes('.m3u8') || src.includes('/hls/') || src.includes('hlsUrl'))) || false;
      setIsHLS(hlsUrl);

      // Create streaming manager
      const manager = new AdaptiveStreamingManager(sourceResolution, {
        enableAutoQuality: autoQuality,
        trackAnalytics: true,
      });

      managerRef.current = manager;

      // Set initial quality recommendation
      const videoElement = videoRef.current || externalVideoElement;
      if (videoElement) {
        const height = videoElement.clientHeight;
        const initialQuality = manager.getInitialQualityRecommendation(height);
        manager.setQuality(initialQuality, 'initialization');
      }

      // Subscribe to events
      const unsubscribe = manager.onStreamingEvent((event) => {
        if (event.type === 'quality-change') {
          setCurrentQuality(event.data.quality);
          if (onQualityChange) {
            onQualityChange(event.data.quality);
          }
        } else if (event.type === 'network-change') {
          if (onNetworkStateChange) {
            onNetworkStateChange(event.data.networkQuality);
          }
        }
      });

      setAvailableQualities(manager.getAvailableQualities());
      setCurrentQuality(manager.getCurrentQuality());

      return () => {
        unsubscribe();
        manager.destroy();
      };
    }, [src, sourceResolution, autoQuality, externalVideoElement, onQualityChange, onNetworkStateChange]);

    /**
     * Initialize HLS support if available
     */
    useEffect(() => {
      if (!videoRef.current) return;

      // For non-HLS sources, the source element handles loading
      if (!isHLS) {
        // Ensure video element is ready for playback
        videoRef.current.load?.();
        return;
      }

      // For HLS sources, use HLS.js
      const initHLS = async () => {
        try {
          const HLS = (await import('hls.js')).default;

          if (!HLS.isSupported()) {
            // Fallback to native HLS support
            if (videoRef.current) {
              videoRef.current.src = src;
              videoRef.current.load?.();
            }
            return;
          }

          const hls = new HLS({
            autoStartLoad: true,
            startLevel: 0,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferLength: 30, // 30 seconds
            liveSyncDuration: 30,
            levelLoadingRetryDelay: 1000,
            manifestLoadingRetryDelay: 1000,
          });

          hlsRef.current = hls;

          if (src) {
            hls.loadSource(src);
          }
          if (videoRef.current) {
            hls.attachMedia(videoRef.current);
          }

          // Handle quality changes
          hls.on(HLS.Events.LEVEL_SWITCHING, (event, data) => {
            if (managerRef.current) {
              const qualities = managerRef.current.getAvailableQualities();
              if (qualities[data.level]) {
                managerRef.current.setQuality(qualities[data.level], 'bandwidth');
              }
            }
          });

          // Handle errors
          hls.on(HLS.Events.ERROR, (event, data) => {
            console.error('HLS Error:', data);
            if (managerRef.current) {
              managerRef.current.recordError(`HLS Error: ${data.type} - ${data.reason}`);
            }
          });

          return () => {
            hls.destroy();
            hlsRef.current = null;
          };
        } catch (error) {
          console.warn('HLS.js not available, using native HLS support:', error);
          if (videoRef.current) {
            videoRef.current.src = src;
            videoRef.current.load?.();
          }
        }
      };

      initHLS();
    }, [isHLS, src]);

    /**
     * Handle time updates
     */
    const handleTimeUpdate = useCallback(
      (e: React.SyntheticEvent<HTMLVideoElement>) => {
        if (onTimeUpdate) {
          onTimeUpdate(e.currentTarget.currentTime);
        }
      },
      [onTimeUpdate]
    );

    /**
     * Handle duration change
     */
    const handleDurationChange = useCallback(
      (e: React.SyntheticEvent<HTMLVideoElement>) => {
        console.log('Video duration loaded:', e.currentTarget.duration);
        if (onDurationChange) {
          onDurationChange(e.currentTarget.duration);
        }
      },
      [onDurationChange]
    );

    /**
     * Handle metadata loaded
     */
    const handleLoadedMetadata = useCallback(() => {
      console.log('Video metadata loaded successfully');
      if (videoRef.current) {
        console.log('Video info:', {
          duration: videoRef.current.duration,
          readyState: videoRef.current.readyState,
          networkState: videoRef.current.networkState
        });
      }
    }, []);

    /**
     * Handle load start
     */
    const handleLoadStart = useCallback(() => {
      console.log('Video load started');
    }, []);

    /**
     * Handle buffering events
     */
    const handleWaiting = useCallback(() => {
      if (managerRef.current) {
        managerRef.current.recordBufferingStart();
      }
    }, []);

    const handlePlaying = useCallback(() => {
      if (managerRef.current) {
        managerRef.current.recordBufferingEnd();
      }
    }, []);

    /**
     * Debug logging for video source
     */
    useEffect(() => {
      console.log('AdaptiveVideoPlayer source updated:', {
        isHLS,
        srcExists: !!src,
        srcLength: src?.length || 0,
        srcPreview: src ? `${src.substring(0, 80)}...` : 'undefined',
        videoElementRef: !!videoRef.current,
        crossOrigin: videoRef.current?.crossOrigin
      });

      if (videoRef.current) {
        // Force reload the video element with new sources
        videoRef.current.load?.();
        
        const sources = videoRef.current.querySelectorAll('source');
        console.log('Video element source elements:', {
          count: sources.length,
          sources: Array.from(sources).map(s => ({ 
            src: (s as any).src?.substring(0, 60) + '...',
            type: (s as any).type 
          }))
        });
      }
    }, [src, isHLS]);

    /**
     * Ref methods exposed to parent
     */
    React.useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      play: async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
          } catch (error) {
            console.error('Play error:', error);
          }
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      getCurrentQuality: () => {
        return managerRef.current?.getCurrentQuality() || null;
      },
      setQuality: (quality: HLSQuality) => {
        if (managerRef.current) {
          managerRef.current.setQuality(quality, 'manual');
        }
        if (hlsRef.current && quality.level !== undefined) {
          hlsRef.current.currentLevel = quality.level;
        }
      },
      getAvailableQualities: () => {
        return managerRef.current?.getAvailableQualities() || [];
      },
      getNetworkMetrics: () => {
        return managerRef.current?.getNetworkMetrics() || {};
      },
      getAnalytics: () => {
        return managerRef.current?.getAnalytics() || {};
      },
    }));

    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-black relative overflow-hidden"
      >
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleDurationChange}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onLoadStart={handleLoadStart}
          onLoadedMetadata={handleLoadedMetadata}
          onError={(e) => {
            const errorCode = e.currentTarget.error?.code;
            const errorMessages: Record<number, string> = {
              1: 'MEDIA_ERR_ABORTED',
              2: 'MEDIA_ERR_NETWORK',
              3: 'MEDIA_ERR_DECODE',
              4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
            };
            console.error('Video loading error:', {
              code: errorCode,
              codeName: errorCode ? errorMessages[errorCode] || 'UNKNOWN' : 'NO_CODE',
              message: e.currentTarget.error?.message,
              src: src?.substring(0, 100) + (src && src.length > 100 ? '...' : ''),
              sourceElements: videoRef.current?.querySelectorAll('source').length,
              videoReadyState: videoRef.current?.readyState,
              videoError: videoRef.current?.error
            });
          }}
        >
          {!isHLS && src && <source src={src} type="video/mp4" />}
          {isHLS && src && <source src={src} type="application/x-mpegURL" />}
          {src === undefined && <div style={{color: 'white', padding: '20px'}}>No video URL provided</div>}
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }
);

AdaptiveVideoPlayer.displayName = 'AdaptiveVideoPlayer';

export default AdaptiveVideoPlayer;
