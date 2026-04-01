/**
 * Video Quality Manager
 * Detects bandwidth and selects appropriate video quality
 * Prioritizes fast loading over quality
 */

export type VideoQuality = '360p' | '480p' | '720p' | '1080p';

export interface QualityOption {
  quality: VideoQuality;
  bitrate: number; // in kbps
  resolution: string;
  fileSize: number; // estimated in MB
}

const QUALITY_PRESETS: Record<VideoQuality, QualityOption> = {
  '360p': {
    quality: '360p',
    bitrate: 500,
    resolution: '640x360',
    fileSize: 50, // ~50MB for 5min video
  },
  '480p': {
    quality: '480p',
    bitrate: 1000,
    resolution: '854x480',
    fileSize: 100,
  },
  '720p': {
    quality: '720p',
    bitrate: 2500,
    resolution: '1280x720',
    fileSize: 250,
  },
  '1080p': {
    quality: '1080p',
    bitrate: 5000,
    resolution: '1920x1080',
    fileSize: 500,
  },
};

/**
 * Detect current bandwidth in Mbps
 */
export function detectBandwidth(): Promise<number> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const testSize = 1024 * 1024; // 1MB
    const testUrl = 'https://via.placeholder.com/1024/1024';
    
    try {
      fetch(testUrl, { cache: 'no-cache' })
        .then(response => response.blob())
        .then(() => {
          const endTime = performance.now();
          const timeInSeconds = (endTime - startTime) / 1000;
          const speedMbps = (testSize / 1024 / 1024) / timeInSeconds;
          console.log('[BandwidthDetector] Detected speed:', speedMbps.toFixed(2), 'Mbps');
          resolve(Math.max(0.5, speedMbps)); // Min 0.5 Mbps
        })
        .catch(() => resolve(2.5)); // Default 2.5 Mbps
    } catch {
      resolve(2.5);
    }
  });
}

/**
 * Recommend quality based on bandwidth and device
 */
export function recommendQuality(bandwidthMbps: number, isLowEndDevice: boolean = false): VideoQuality {
  // Very slow connection or low-end device
  if (bandwidthMbps < 1 || isLowEndDevice) {
    return '360p';
  }
  
  // Slow connection
  if (bandwidthMbps < 2.5) {
    return '360p';
  }
  
  // Medium connection
  if (bandwidthMbps < 5) {
    return '480p';
  }
  
  // Good connection
  if (bandwidthMbps < 10) {
    return '720p';
  }
  
  // Excellent connection
  return '1080p';
}

/**
 * Get recommended startup quality
 * Always prioritizes FASTER loading over quality on initial load
 */
export function getStartupQuality(bandwidthMbps: number): VideoQuality {
  // For initial load, we're more conservative to ensure fast startup
  // Recommend one level lower than actual capability
  if (bandwidthMbps < 1) return '360p';
  if (bandwidthMbps < 2) return '360p';
  if (bandwidthMbps < 4) return '360p';
  if (bandwidthMbps < 7) return '480p';
  if (bandwidthMbps < 15) return '720p';
  return '1080p';
}

/**
 * Check if device is likely low-end (mobile, older device)
 */
export function isLowEndDevice(): boolean {
  // Check if mobile
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  
  // Check available memory (if accessible)
  const isLowMemory = 
    (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
  
  // Check processor cores
  const isLowCore =
    navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
  
  return isMobile || isLowMemory || isLowCore;
}

/**
 * Get quality info
 */
export function getQualityInfo(quality: VideoQuality): QualityOption {
  return QUALITY_PRESETS[quality];
}

/**
 * Get all available qualities
 */
export function getAvailableQualities(): VideoQuality[] {
  return ['360p', '480p', '720p', '1080p'];
}

/**
 * Calculate estimated download time
 */
export function estimateDownloadTime(
  qualityFileSize: number,
  bandwidthMbps: number
): number {
  // Convert file size (MB) and bandwidth (Mbps) to seconds
  const fileSizeInMegabits = qualityFileSize * 8;
  const secondsToDownload = fileSizeInMegabits / bandwidthMbps;
  return Math.round(secondsToDownload);
}

/**
 * Quality range for device type
 */
export function getQualityRange(isLowEndDevice: boolean): {
  min: VideoQuality;
  recommended: VideoQuality;
  max: VideoQuality;
} {
  if (isLowEndDevice) {
    return {
      min: '360p',
      recommended: '480p',
      max: '720p',
    };
  }
  
  return {
    min: '480p',
    recommended: '720p',
    max: '1080p',
  };
}
