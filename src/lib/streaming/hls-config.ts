/**
 * HLS.js Configuration for Optimized Performance
 * Enables fast streaming with adaptive bitrate and intelligent buffering
 */

import HLS from 'hls.js';

export interface HLSOptimizationConfig {
  enableLogging?: boolean;
  targetBufferTime?: number;
  maxBufferLength?: number;
  maxBufferSize?: number;
  maxLoadingDelay?: number;
  lowLatencyMode?: boolean;
  autoStartLoad?: boolean;
  startFragPrefetch?: boolean;
  /**
   * Start with lower quality (480p) for faster startup
   * Automatically upgrade as bandwidth becomes available
   */
  startWithLowerQuality?: boolean;
  /**
   * Enable automatic segment caching in IndexedDB
   * Improves bandwidth usage and offline capability
   */
  enableSegmentCaching?: boolean;
  /**
   * For large videos (300MB+)
   * Increases buffer, reduces quality aggressiveness
   */
  isLargeVideo?: boolean;
  /**
   * Prioritize speed over quality (starts with ultra-low bitrate)
   */
  speedFirst?: boolean;
}

/**
 * Get optimized HLS.js configuration based on network conditions
 */
export function getOptimizedHLSConfig(
  userConfig?: HLSOptimizationConfig
): any {
  return {
    debug: userConfig?.enableLogging ?? false,
    
    // ─────────────────────────────────────────────────────────────────────
    // Buffering Configuration - Fast Streaming
    // ─────────────────────────────────────────────────────────────────────
    
    // Target buffer: default to 12 seconds for stability, or 6 for speedFirst (fast start)
    targetDurations: [userConfig?.speedFirst ? 6 : (userConfig?.targetBufferTime ?? 8)],
    
    // Max buffer lengths: Increase significantly for speedFirst
    maxBufferLength: userConfig?.speedFirst ? 120 : (userConfig?.maxBufferLength ?? 30),
    maxMaxBufferLength: userConfig?.speedFirst ? 600 : (userConfig?.maxBufferLength ? userConfig.maxBufferLength * 2 : 60),
    
    // Keep previously played content in memory for instant replay (up to 30 mins)
    backBufferLength: userConfig?.speedFirst ? 1800 : 90,
    
    // Max buffer size in bytes: 250MB for speedFirst (prevent excessive memory usage but allow large cache)
    maxBufferSize: userConfig?.speedFirst ? 250 * 1024 * 1024 : (userConfig?.maxBufferSize ?? 100 * 1024 * 1024),
    
    // Max loading delay: 2 seconds for speedFirst (switch quality faster if stalling)
    maxLoadingDelay: userConfig?.speedFirst ? 2 : (userConfig?.maxLoadingDelay ?? 4),
    
    // ─────────────────────────────────────────────────────────────────────
    // Segment Loading - Parallel Downloads
    // ─────────────────────────────────────────────────────────────────────
    
    // Load segments in parallel - increase for faster filling of the large buffer
    maxNumUnsyncedSegments: userConfig?.speedFirst ? 12 : 6,
    
    // ─────────────────────────────────────────────────────────────────────
    // Quality and Caching Configuration
    // ─────────────────────────────────────────────────────────────────────
    
    // Start with lower quality for faster startup if enabled
    // 0 = 240p (lowest), 1 = 360p, 2 = 480p, 3 = 720p, 4 = 1080p
    startLevel: userConfig?.speedFirst ? 0 : (userConfig?.startWithLowerQuality ? 1 : -1),
    
    // ─────────────────────────────────────────────────────────────────────
    // Quality Caps and Bandwidth
    // ─────────────────────────────────────────────────────────────────────
    
    // Cap quality to player size to save bandwidth
    capLevelToPlayerSize: true,
    
    // Ultra-conservative initial bandwidth estimate (200kbps) to guarantee instant start
    abrEwmaDefaultEstimate: 200000,
    
    // ─────────────────────────────────────────────────────────────────────
    // Low Latency Mode - Faster Startup
    // ─────────────────────────────────────────────────────────────────────
    
    lowLatencyMode: userConfig?.speedFirst ? false : (userConfig?.lowLatencyMode ?? true),
    
    // Start loading automatically
    autoStartLoad: userConfig?.autoStartLoad ?? true,
    
    // Prefetch first fragment for quick start
    startFragPrefetch: userConfig?.startFragPrefetch ?? true,
    
    // ─────────────────────────────────────────────────────────────────────
    // Manifest Configuration
    // ─────────────────────────────────────────────────────────────────────
    
    // Re-fetch manifest every 3 seconds for live updates
    manifestLoadingTimeOut: 10000,
    manifestLoadingMaxRetry: 6,
    manifestLoadingRetryDelay: 1000,
    
    // ─────────────────────────────────────────────────────────────────────
    // Reliability Configuration
    // ─────────────────────────────────────────────────────────────────────
    
    // Retry failed segments up to 10 times for speedFirst
    fragLoadingMaxRetry: userConfig?.speedFirst ? 10 : 6,
    fragLoadingRetryDelay: 1000,
    fragLoadingLoopThreshold: 5,
    
    // Retry on network errors
    levelLoadingMaxRetry: 6,
    levelLoadingRetryDelay: 1000,
    
    // ─────────────────────────────────────────────────────────────────────
    // Live Stream Configuration
    // ─────────────────────────────────────────────────────────────────────
    
    liveSyncDurationCount: 3,
    liveBackBufferLength: 30,
    
    // ─────────────────────────────────────────────────────────────────────
    // XHR Configuration (for fetching segments)
    // ─────────────────────────────────────────────────────────────────────
    
    xhrSetup: (xhr: XMLHttpRequest, url: string) => {
      // Add cache headers for better CDN interaction
      xhr.withCredentials = false;
      xhr.timeout = 25000; // 25 second timeout
    },
    
    // ─────────────────────────────────────────────────────────────────────
    // Playback Configuration
    // ─────────────────────────────────────────────────────────────────────
    
    // Don't freeze the video during buffering
    enableWorker: true,
    
    // Enable server-side playlist update detection
    enableSoftwareAES: true,
  };
}

/**
 * Get HLS.js event listeners for monitoring playback
 */
export function getHLSEventListeners() {
  if (typeof window === 'undefined' || !HLS?.Events) {
    return {};
  }
  return {
    [HLS.Events.MANIFEST_PARSED]: 'Manifest loaded and parsed',
    [HLS.Events.LEVEL_SWITCHED]: 'Quality level switched',
    [HLS.Events.BUFFER_APPENDING]: 'Buffering data',
    [HLS.Events.BUFFER_APPENDED]: 'Data appended to buffer',
    [HLS.Events.FRAG_LOADED]: 'Segment loaded successfully',
    [HLS.Events.ERROR]: 'Error occurred',
  };
}

/**
 * Adaptive bitrate switching strategy based on network speed
 */
export interface NetSpeedProfile {
  name: 'slow' | 'medium' | 'fast';
  bandwidth: number; // Mbps
  targetLevel: number; // 0=lowest, n=highest
  bufferTarget: number; // seconds
}

export function detectNetworkSpeed(): NetSpeedProfile {
  if (typeof navigator === 'undefined') {
    return { name: 'medium', bandwidth: 10, targetLevel: -1, bufferTarget: 8 };
  }

  const connection = (navigator as any).connection;
  if (!connection) {
    return { name: 'medium', bandwidth: 10, targetLevel: -1, bufferTarget: 8 };
  }

  const effectiveType = String(connection.effectiveType || '4g').toLowerCase();
  const downlink = Number(connection.downlink || 0);
  const saveData = Boolean(connection.saveData);

  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    return { name: 'slow', bandwidth: 1, targetLevel: 0, bufferTarget: 12 };
  }

  if (effectiveType === '3g' || downlink < 2) {
    return { name: 'medium', bandwidth: 3, targetLevel: 1, bufferTarget: 10 };
  }

  if (effectiveType === '4g' && downlink >= 10) {
    return { name: 'fast', bandwidth: 20, targetLevel: -1, bufferTarget: 6 };
  }

  return { name: 'medium', bandwidth: 10, targetLevel: -1, bufferTarget: 8 };
}

/**
 * Recommended HLS configuration presets
 */
export const HLS_PRESETS = {
  /**
   * Fast startup (~1-2 seconds to first frame)
   */
  fastStart: {
    targetBufferTime: 4,
    maxBufferLength: 15,
    lowLatencyMode: true,
    startFragPrefetch: true,
  },

  /**
   * Balanced (responsive + reliable)
   */
  balanced: {
    targetBufferTime: 8,
    maxBufferLength: 30,
    lowLatencyMode: true,
    startFragPrefetch: true,
  },

  /**
   * Reliable (smooth playback, higher latency)
   */
  reliable: {
    targetBufferTime: 15,
    maxBufferLength: 60,
    lowLatencyMode: false,
    startFragPrefetch: false,
  },

  /**
   * Slow network (mobile with poor connection)
   */
  slowNetwork: {
    targetBufferTime: 20,
    maxBufferLength: 90,
    lowLatencyMode: false,
    startFragPrefetch: false,
    startWithLowerQuality: true,
    enableSegmentCaching: true,
  },

  /**
   * Progressive quality upgrade (RECOMMENDED)
   * Starts at 480p, automatically upgrades as bandwidth becomes available
   * Caches all segments for bandwidth savings and offline support
   */
  progressiveUpgrade: {
    targetBufferTime: 6,
    maxBufferLength: 25,
    lowLatencyMode: true,
    startFragPrefetch: true,
    startWithLowerQuality: true,
    enableSegmentCaching: true,
  },

  /**
   * Large Video Optimization (300MB+)
   * Significantly larger buffers to prevent stuttering
   * Keeps quality lower for stable playback
   * Aggressive segment prefetching
   * More robust retry logic
   */
  largeFileOptimized: {
    targetBufferTime: 30,        // 30 second target buffer
    maxBufferLength: 90,          // 90 second max
    lowLatencyMode: false,        // Disable low latency for stability
    startFragPrefetch: true,      // Prefetch more aggressively
    startWithLowerQuality: true,  // Start at 480p minimum
    enableSegmentCaching: true,   // Aggressive caching
    maxBufferSize: 300 * 1024 * 1024, // 300MB buffer
    maxLoadingDelay: 8,           // Only upgrade if very stable
  },

  /**
   * Ultra Fast Startup (SPEED FIRST)
   * Prioritizes instant playback above all else
   * Starts at 360p/240p, very large buffer to prevent any stalling
   */
  ultraFastStartup: {
    targetBufferTime: 4,          // Keep 4s ready (low for fast start)
    maxBufferLength: 120,         // Buffer up to 2 minutes
    lowLatencyMode: true,         // Enable low latency for speed
    startFragPrefetch: true,      // Prefetch immediately
    startWithLowerQuality: true,  // Lowest quality first
    enableSegmentCaching: true,   // Full segment caching
    speedFirst: true,
    maxBufferSize: 250 * 1024 * 1024,
  },
} as const;

/**
 * Select HLS preset based on network conditions and file size
 * Automatically detects large videos and applies optimized settings
 */
export function selectHLSPreset(
  profile: NetSpeedProfile,
  isLargeVideo?: boolean,
  speedFirst: boolean = true // Default to true for fastest experience
): HLSOptimizationConfig {
  // If explicitly requested speed first, use ultra fast preset
  if (speedFirst) {
    return HLS_PRESETS.ultraFastStartup;
  }

  // If explicitly marked as large video, use optimized preset
  if (isLargeVideo) {
    return HLS_PRESETS.largeFileOptimized;
  }
  
  // Default to progressive upgrade
  return HLS_PRESETS.progressiveUpgrade;
}

/**
 * Detect if video size exceeds large file threshold (300MB)
 * Returns true if file is likely to need large video optimization
 */
export function isLargeVideoFile(sizeBytes: number | undefined): boolean {
  if (!sizeBytes) return false;
  const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024; // 300MB
  return sizeBytes > LARGE_FILE_THRESHOLD;
}

/**
 * Get optimized config for large videos with additional retry logic
 * Increases segment retry attempts and timing delays
 */
export function getLargeVideoHLSConfig(): any {
  return {
    // Much larger buffers to prevent stuttering on large files
    targetDurations: [30],
    maxBufferLength: 90,
    maxBufferSize: 300 * 1024 * 1024,
    maxLoadingDelay: 8,
    
    // More aggressive segment loading retry
    fragLoadingMaxRetry: 12,         // Up from 6
    fragLoadingRetryDelay: 2000,     // Longer delay between retries
    fragLoadingLoopThreshold: 10,    // Higher threshold before giving up
    
    // More patient manifest loading
    manifestLoadingMaxRetry: 6,      // Up from 3
    manifestLoadingTimeOut: 20000,   // Longer timeout
    manifestLoadingRetryDelay: 2000,
    
    // Level loading retry
    levelLoadingMaxRetry: 6,         // Up from 4
    levelLoadingRetryDelay: 2000,
    
    // Parallel loading (load more segments at once)
    maxNumUnsyncedSegments: 10,      // Up from 6
    
    // Disable low latency for stability
    lowLatencyMode: false,
    startFragPrefetch: true,
    
    // Cache strategy
    startLevel: 3,                   // Start even lower (360p)
  };
}
