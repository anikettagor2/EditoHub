/**
 * useAdaptiveVideo Hook
 * Handles adaptive quality loading and switching
 * Automatically upgrades quality as bandwidth allows
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getAdaptiveVideoUrl,
  preloadUpgradeQuality,
  monitorAndUpgradeQuality,
  type AdaptiveVideoUrlOptions,
  type AdaptiveVideoUrlResult,
} from '@/lib/firebase/adaptiveVideoLoader';

export interface AdaptiveVideoState {
  url: string | null;
  quality: string;
  isLoading: boolean;
  error: Error | null;
  canUpgrade: boolean;
  bandwidth?: number;
}

/**
 * Hook for adaptive video loading
 *
 * @example
 * const { url, quality, canUpgrade, upgradeQuality } = useAdaptiveVideo({
 *   videoId: 'video123',
 *   storagePath: 'videos/original/video.mp4',
 *   useAdaptiveQuality: true,
 * });
 *
 * return (
 *   <div>
 *     <video src={url} controls />
 *     {canUpgrade && <button onClick={upgradeQuality}>Upgrade to HD</button>}
 *     <p>Quality: {quality}</p>
 *   </div>
 * );
 */
export function useAdaptiveVideo(options: AdaptiveVideoUrlOptions) {
  const [state, setState] = useState<AdaptiveVideoState>({
    url: null,
    quality: '360p',
    isLoading: true,
    error: null,
    canUpgrade: false,
  });

  const resultRef = useRef<AdaptiveVideoUrlResult | null>(null);
  const upgradeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  /**
   * Load adaptive video
   */
  const load = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const result = await getAdaptiveVideoUrl(options);
      resultRef.current = result;

      setState({
        url: result.url,
        quality: result.quality,
        isLoading: false,
        error: null,
        canUpgrade: result.canUpgrade ?? false,
        bandwidth: result.bandwidth,
      });

      // Preload upgrade quality in background
      if (result.canUpgrade) {
        upgradeTimeoutRef.current = setTimeout(() => {
          preloadUpgradeQuality(result).catch(err => {
            console.warn('[useAdaptiveVideo] Failed to preload upgrade:', err);
          });
        }, 1000);
      }

      console.log('[useAdaptiveVideo] Loaded:', {
        quality: result.quality,
        canUpgrade: result.canUpgrade,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err,
        url: null,
      }));

      console.error('[useAdaptiveVideo] Failed to load:', err.message);
    }
  }, [options]);

  /**
   * Upgrade to better quality
   */
  const upgradeQuality = useCallback(
    async (videoRef?: HTMLVideoElement | null) => {
      if (!resultRef.current?.upgradePath) {
        console.warn('[useAdaptiveVideo] No upgrade available');
        return false;
      }

      setState(prev => ({
        ...prev,
        isLoading: true,
      }));

      try {
        const upgraded = await monitorAndUpgradeQuality(
          videoRef || null,
          resultRef.current.upgradePath
        );

        if (upgraded) {
          setState(prev => ({
            ...prev,
            url: resultRef.current?.upgradePath || null,
            quality: 'higher',
            isLoading: false,
            canUpgrade: false,
          }));
        } else {
          setState(prev => ({
            ...prev,
            isLoading: false,
          }));
        }

        return upgraded;
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
        return false;
      }
    },
    []
  );

  /**
   * Force specific quality
   */
  const setQuality = useCallback(
    async (quality: string) => {
      setState(prev => ({
        ...prev,
        isLoading: true,
      }));

      try {
        const result = await getAdaptiveVideoUrl({
          ...options,
          forcedQuality: quality as any,
        });

        resultRef.current = result;

        setState({
          url: result.url,
          quality: result.quality,
          isLoading: false,
          error: null,
          canUpgrade: result.canUpgrade ?? false,
        });
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    },
    [options]
  );

  /**
   * Auto-load on mount
   */
  useEffect(() => {
    load();

    return () => {
      if (upgradeTimeoutRef.current) {
        clearTimeout(upgradeTimeoutRef.current);
      }
    };
  }, [load]);

  return {
    ...state,
    load,
    upgradeQuality,
    setQuality,
    isInitialized: state.url !== null,
  };
}

/**
 * Hook for monitoring and auto-upgrading during playback
 */
export function useQualityMonitoring(
  videoRef: React.RefObject<HTMLVideoElement>,
  canUpgrade: boolean,
  upgradePath?: string
) {
  const monitoringRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (!canUpgrade || !upgradePath || !videoRef.current) {
      return;
    }

    // Start monitoring 2 seconds into playback
    const handlePlay = () => {
      monitoringRef.current = setInterval(async () => {
        if (videoRef.current && videoRef.current.currentTime > 2) {
          await monitorAndUpgradeQuality(videoRef.current, upgradePath);
          clearInterval(monitoringRef.current);
        }
      }, 1000);
    };

    const video = videoRef.current;
    video.addEventListener('play', handlePlay);

    return () => {
      if (monitoringRef.current) {
        clearInterval(monitoringRef.current);
      }
      video.removeEventListener('play', handlePlay);
    };
  }, [canUpgrade, upgradePath, videoRef]);
}
