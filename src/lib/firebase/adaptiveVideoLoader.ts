/**
 * Adaptive Video URL Loader
 * Loads appropriate quality based on device and bandwidth
 * Includes fallback to original if encoded versions unavailable
 */

import { getVideoUrl, getVideoUrlWithMetadata } from './getVideoUrl';
import {
  detectBandwidth,
  getStartupQuality,
  recommendQuality,
  isLowEndDevice,
  type VideoQuality,
} from '@/lib/video/qualityDetector';
import {
  cacheVideoUrl,
  getCachedVideoUrl,
} from './videoUrlCache';
import {
  getCachedVideoMetadata,
  cacheVideoMetadata,
  type VideoMetadataCache,
} from './videoMetadataCache';

export interface AdaptiveVideoUrlOptions {
  videoId: string;
  storagePath: string;
  metadata?: Partial<VideoMetadataCache>;
  useAdaptiveQuality?: boolean;
  forcedQuality?: VideoQuality;
  detectBandwidth?: boolean;
  cacheDurationHours?: number;
  useCache?: boolean;
}

export interface AdaptiveVideoUrlResult {
  url: string;
  quality: VideoQuality;
  storagePath: string;
  bandwidth?: number;
  isOptimized: boolean;
  wasCached: boolean;
  estimatedLoadTime?: number;
  canUpgrade?: boolean;
  upgradePath?: string;
}

/**
 * Get adaptive video URL based on device and bandwidth
 * Prioritizes FAST LOADING over quality on initial load
 *
 * @example
 * const result = await getAdaptiveVideoUrl({
 *   videoId: 'video123',
 *   storagePath: 'videos/original/video.mp4',
 *   useAdaptiveQuality: true,
 *   detectBandwidth: true,
 * });
 *
 * console.log(`Loading ${result.quality}: ${result.url}`);
 */
export async function getAdaptiveVideoUrl(
  options: AdaptiveVideoUrlOptions
): Promise<AdaptiveVideoUrlResult> {
  const {
    videoId,
    storagePath,
    metadata,
    useAdaptiveQuality = true,
    forcedQuality,
    detectBandwidth: shouldDetectBandwidth = true,
    cacheDurationHours = 1,
    useCache = true,
  } = options;

  try {
    // 1. Check if we have encoded qualities in metadata
    let metadata_ = metadata;
    if (!metadata_ && useCache) {
      const cached = await getCachedVideoMetadata(videoId);
      metadata_ = cached || undefined;
    }

    const encodedQualities = (metadata_ as any)?.encodedQualities || null;

    // 2. Determine target quality
    let targetQuality: VideoQuality = '360p'; // Default safe quality

    if (forcedQuality) {
      targetQuality = forcedQuality;
    } else if (useAdaptiveQuality && encodedQualities) {
      // Detect bandwidth if requested
      let bandwidth: number | undefined;
      if (shouldDetectBandwidth) {
        bandwidth = await detectBandwidth();
        console.log('[AdaptiveVideo] Detected bandwidth:', bandwidth.toFixed(2), 'Mbps');
      } else {
        // Use default estimate
        bandwidth = 2.5;
      }

      const isLowEnd = isLowEndDevice();
      targetQuality = getStartupQuality(bandwidth);

      console.log('[AdaptiveVideo] Recommended quality:', targetQuality, {
        bandwidth: bandwidth.toFixed(2),
        lowEnd: isLowEnd,
      });
    }

    // 3. Find the quality URL
    let videoUrl: string | null = null;
    let actualQuality = targetQuality;
    let upgradeQualityAvailable: string | null = null;

    if (encodedQualities && useAdaptiveQuality) {
      // Try target quality first
      if (encodedQualities[targetQuality]) {
        videoUrl = await getVideoUrl(
          videoId,
          encodedQualities[targetQuality],
          {
            useCache,
            cacheDurationHours,
          }
        ).then(r => r.url);
      }

      // Fallback to available qualities if target not found
      if (!videoUrl) {
        const qualities: VideoQuality[] = ['360p', '480p', '720p'];
        for (const quality of qualities) {
          if (encodedQualities[quality]) {
            videoUrl = await getVideoUrl(
              videoId,
              encodedQualities[quality],
              {
                useCache,
                cacheDurationHours,
              }
            ).then(r => r.url);
            actualQuality = quality;
            if (videoUrl) break;
          }
        }
      }

      // Check if better quality is available
      const availableQualities = Object.keys(encodedQualities);
      const qualityOrder: VideoQuality[] = ['360p', '480p', '720p'];
      const currentIndex = qualityOrder.indexOf(actualQuality);

      if (currentIndex < qualityOrder.length - 1) {
        const nextQuality = qualityOrder[currentIndex + 1];
        if (availableQualities.includes(nextQuality)) {
          upgradeQualityAvailable = nextQuality;
        }
      }
    }

    // 4. Fallback to original if no encoded versions found
    if (!videoUrl) {
      console.log('[AdaptiveVideo] No encoded versions, using original');
      const result = await getVideoUrl(videoId, storagePath, {
        useCache,
        cacheDurationHours,
      });
      videoUrl = result.url;
    }

    if (!videoUrl) {
      throw new Error('Failed to get video URL');
    }

    // 5. Cache and return result
    const result: AdaptiveVideoUrlResult = {
      url: videoUrl,
      quality: actualQuality,
      storagePath: encodedQualities?.[actualQuality] || storagePath,
      isOptimized:
        encodedQualities?.[actualQuality] !== undefined,
      wasCached: useCache,
      canUpgrade: upgradeQualityAvailable !== null,
      upgradePath: upgradeQualityAvailable
        ? encodedQualities?.[upgradeQualityAvailable as VideoQuality]
        : undefined,
    };

    console.log('[AdaptiveVideo] Selected quality:', result.quality, {
      optimized: result.isOptimized,
      canUpgrade: result.canUpgrade,
    });

    return result;
  } catch (error) {
    console.error('[AdaptiveVideo] Error getting adaptive URL:', error);
    throw error;
  }
}

/**
 * Preload higher quality video for seamless quality upgrade
 */
export async function preloadUpgradeQuality(
  result: AdaptiveVideoUrlResult
): Promise<void> {
  if (!result.upgradePath) {
    return;
  }

  try {
    console.log('[AdaptiveVideo] Preloading upgrade quality:', result.upgradePath);

    // Preload with small timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    await fetch(result.upgradePath, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('[AdaptiveVideo] Upgrade quality preloaded');
  } catch (error) {
    console.warn('[AdaptiveVideo] Failed to preload upgrade quality:', error);
  }
}

/**
 * Monitor bandwidth and upgrade quality if possible
 */
export async function monitorAndUpgradeQuality(
  videoRef: HTMLVideoElement | null,
  upgradeUrl: string | undefined
): Promise<boolean> {
  if (!videoRef || !upgradeUrl) {
    return false;
  }

  try {
    const currentTime = videoRef.currentTime;
    const bandwidth = await detectBandwidth();

    // Only upgrade if bandwidth allows and playback is smooth
    if (
      bandwidth > 5 &&
      videoRef.buffered.length > 0 &&
      currentTime < videoRef.duration * 0.1 // Only upgrade in first 10%
    ) {
      console.log('[AdaptiveVideo] Upgrading quality based on bandwidth');

      // Set new source and resume from same position
      const currentSource = videoRef.currentSrc;
      videoRef.src = upgradeUrl;
      videoRef.currentTime = currentTime;

      return true;
    }
  } catch (error) {
    console.warn('[AdaptiveVideo] Error monitoring bandwidth:', error);
  }

  return false;
}

/**
 * Get all quality options for a video
 */
export async function getAvailableQualities(
  videoId: string,
  forceRefresh: boolean = false
): Promise<VideoQuality[]> {
  try {
    const metadata = await getCachedVideoMetadata(videoId);
    if (!metadata && !forceRefresh) {
      return ['360p']; // Default fallback
    }

    const encodedQualities = (metadata as any)?.encodedQualities;
    if (encodedQualities) {
      return Object.keys(encodedQualities) as VideoQuality[];
    }

    return ['360p'];
  } catch (error) {
    console.warn('[AdaptiveVideo] Error getting available qualities:', error);
    return ['360p'];
  }
}

/**
 * Bulk get adaptive URLs for multiple videos efficiently
 */
export async function getMultipleAdaptiveVideoUrls(
  videos: Array<Omit<AdaptiveVideoUrlOptions, 'detectBandwidth'>>,
  globalOptions?: {
    detectBandwidth?: boolean;
    skipBandwidthDetectionAfter?: number;
  }
): Promise<AdaptiveVideoUrlResult[]> {
  const { detectBandwidth: shouldDetectBandwidth = true, skipBandwidthDetectionAfter = 5 } = globalOptions || {};

  // Detect bandwidth once for all videos
  let bandwidth: number | undefined;
  if (shouldDetectBandwidth) {
    bandwidth = await detectBandwidth();
    console.log('[AdaptiveVideo] Detected bandwidth for batch:', bandwidth.toFixed(2));
  }

  const results = await Promise.allSettled(
    videos.map((video, index) =>
      getAdaptiveVideoUrl({
        ...video,
        detectBandwidth: shouldDetectBandwidth && index < skipBandwidthDetectionAfter,
      })
    )
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.error(
      `Failed to get adaptive URL for video ${videos[index].videoId}:`,
      result.reason
    );
    throw result.reason;
  });
}
