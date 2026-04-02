/**
 * Video Preloading Optimization
 * 
 * Strategies for fast video startup:
 * 1. Preload HLS manifest
 * 2. Prefetch first segments
 * 3. Cache manifest in IndexedDB
 * 4. Preload metadata before play
 */

import React from 'react';

/**
 * Utility: Check if URL is an HLS manifest
 */
function isHLSManifest(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  // Check for .m3u8 extension or HLS-specific markers
  return urlLower.includes('.m3u8') || urlLower.includes('playlist');
}

/**
 * Utility: Get video file extension from URL
 */
function getVideoExtension(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const match = pathname.match(/\.(mp4|webm|mov|mkv|avi|flv|m3u8)(?:\?|$)/i);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/**
 * Utility: Check if URL is a direct video file (not HLS)
 */
function isDirectVideoFile(url: string): boolean {
  const ext = getVideoExtension(url);
  return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv'].includes(ext);
}

/**
 * Preload HLS manifest (m3u8 file) to cache before playback
 * Returns early if URL is not an HLS manifest
 */
export async function preloadHLSManifest(manifestUrl: string): Promise<Response> {
  try {
    // Validate URL
    if (!manifestUrl || typeof manifestUrl !== 'string') {
      throw new Error('Invalid manifest URL provided');
    }

    // Skip preloading if not an HLS manifest
    if (!isHLSManifest(manifestUrl)) {
      const ext = getVideoExtension(manifestUrl);
      if (isDirectVideoFile(manifestUrl)) {
        console.log(`[Preload] Skipping HLS preload for direct video file (.${ext})`);
        // Return a dummy response for direct video files
        return new Response('', { status: 200 });
      }
      throw new Error(`URL is not an HLS manifest (detected: .${ext || 'unknown'})`);
    }

    console.log('[Preload] Starting HLS manifest preload:', manifestUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(manifestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.apple.mpegurl',
        },
        mode: 'cors',
        cache: 'force-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('[Preload] HLS manifest cached:', manifestUrl);
      return response;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Manifest fetch timeout after 30s');
        }
        if (fetchError.message.includes('Failed to fetch')) {
          throw new Error(`Network error: Failed to fetch manifest. This may be due to CORS restrictions or network connectivity. URL: ${manifestUrl}`);
        }
      }
      throw fetchError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log error with better formatting
    console.warn(
      '[Preload] HLS manifest preload skipped:',
      `Error: ${errorMessage}`
    );

    // For direct video files, this is not an error - just return
    if (isDirectVideoFile(manifestUrl)) {
      return new Response('', { status: 200 });
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to preload manifest: ${errorMessage}`);
  }
}

/**
 * Preload first N segments of HLS stream
 * Reduces startup time significantly
 */
export async function preloadHLSSegments(
  manifestUrl: string,
  segmentCount: number = 3,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  try {
    // Fetch and parse manifest
    const manifestResponse = await fetch(manifestUrl, { 
      cache: 'force-cache',
      mode: 'cors'
    });
    
    if (!manifestResponse.ok) {
      console.warn(`[Preload] Failed to fetch manifest for segments: HTTP ${manifestResponse.status}`);
      return;
    }

    const manifestText = await manifestResponse.text();

    // Parse segment URIs from manifest
    const segmentUrls = parseHLSManifest(manifestText, manifestUrl);

    if (segmentUrls.length === 0) {
      console.warn('[Preload] No segments found in manifest');
      return;
    }

    // Preload first N segments
    const toPreload = segmentUrls.slice(0, Math.min(segmentCount, segmentUrls.length));

    console.log(`[Preload] Preloading ${toPreload.length} segments out of ${segmentUrls.length}`);

    for (let i = 0; i < toPreload.length; i++) {
      try {
        const segmentUrl = toPreload[i];
        await fetch(segmentUrl, {
          method: 'HEAD', // Use HEAD to check availability without full download
          cache: 'force-cache',
        });
        onProgress?.(i + 1, toPreload.length);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(
          `[Preload] Failed to preload segment ${i}:`,
          `URL: ${toPreload[i] || 'UNKNOWN'}`,
          `Error: ${errorMessage || 'UNKNOWN'}`
        );
      }
    }

    console.log('[Preload] Segment preloading complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      '[Preload] Failed to preload segments:',
      `URL: ${manifestUrl || 'UNKNOWN'}`,
      `Error: ${errorMessage || 'UNKNOWN'}`
    );
    // Don't throw - preloading is optional
  }
}

/**
 * Parse HLS m3u8 manifest and extract segment URLs
 */
export function parseHLSManifest(manifestContent: string, baseUrl: string): string[] {
  const lines = manifestContent.split('\n');
  const segments: string[] = [];
  let variantUrl: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Check if this line is a URL
    if (!trimmed.startsWith('http')) {
      // If it's a relative path, resolve it
      const url = new URL(trimmed, baseUrl);
      segments.push(url.toString());

      // Track variant playlist for master manifest
      if (trimmed.endsWith('.m3u8')) {
        variantUrl = url.toString();
      }
    } else {
      // Absolute URL
      segments.push(trimmed);
    }
  }

  return segments;
}

/**
 * IndexedDB storage for HLS manifest caching
 */
const DB_NAME = 'hls-cache';
const STORE_NAME = 'manifests';
const DB_VERSION = 1;

async function getHLSDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
  });
}

export async function cacheManifestInDB(url: string, content: string, ttlMinutes: number = 60): Promise<void> {
  try {
    const db = await getHLSDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put({
      url,
      content,
      timestamp: Date.now(),
      ttlMinutes,
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });

    console.log('[HLS Cache] Manifest cached in IndexedDB:', url);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      '[HLS Cache] Failed to cache manifest in IndexedDB:',
      `URL: ${url || 'UNKNOWN'}`,
      `Error: ${errorMessage || 'UNKNOWN'}`
    );
    // Graceful fallback - if IndexedDB fails, we still have HTTP cache
  }
}

export async function getManifestFromDB(url: string): Promise<string | null> {
  try {
    const db = await getHLSDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          resolve(null);
          return;
        }

        // Check if cache is still valid
        const ageMinutes = (Date.now() - result.timestamp) / (1000 * 60);
        if (ageMinutes > result.ttlMinutes) {
          // Cache expired - delete it
          store.delete(url);
          resolve(null);
          return;
        }

        console.log('[HLS Cache] Manifest retrieved from IndexedDB:', url);
        resolve(result.content);
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      '[HLS Cache] Failed to retrieve manifest from IndexedDB:',
      `URL: ${url || 'UNKNOWN'}`,
      `Error: ${errorMessage || 'UNKNOWN'}`
    );
    return null;
  }
}

export async function clearHLSCache(): Promise<void> {
  try {
    const db = await getHLSDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });

    console.log('[HLS Cache] Cache cleared');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      '[HLS Cache] Failed to clear cache:',
      `Error: ${errorMessage || 'UNKNOWN'}`
    );
  }
}

/**
 * Strategically preload video for optimal startup
 * Handles both HLS manifests and direct video files
 */
export async function preloadVideoOptimally(
  hlsUrl: string,
  options?: {
    segmentCount?: number;
    cacheDuration?: number;
    useIndexedDB?: boolean;
  }
): Promise<void> {
  const { segmentCount = 3, cacheDuration = 60, useIndexedDB = true } = options || {};

  try {
    // Validate URL
    if (!hlsUrl || typeof hlsUrl !== 'string') {
      console.warn('[Preload] Invalid video URL provided');
      return;
    }

    // Check if this is a direct video file or HLS manifest
    if (isDirectVideoFile(hlsUrl)) {
      console.log('[Preload] Direct video file detected - skipping preload to avoid cache poisoning range requests');
      // Do NOT pre-fetch direct MP4 files with Range headers.
      // Caching a partial range response interferes with the video element's own range request management.
      // The browser handles MP4 buffering natively and efficiently without intervention.
      return;
    }

    if (!isHLSManifest(hlsUrl)) {
      console.log('[Preload] URL does not appear to be HLS or direct video - skipping preload');
      return;
    }

    // 1. Check IndexedDB cache first
    if (useIndexedDB && isHLSManifest(hlsUrl)) {
      try {
        const cachedManifest = await getManifestFromDB(hlsUrl);
        if (cachedManifest) {
          console.log('[Preload] Using cached manifest from IndexedDB');
          // Still preload segments in background
          preloadHLSSegments(hlsUrl, segmentCount).catch(err => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.warn('[Preload] Background segment preload failed:', errorMsg);
          });
          return;
        }
      } catch (cacheError) {
        const errorMsg = cacheError instanceof Error ? cacheError.message : String(cacheError);
        console.warn('[Preload] Cache check failed, continuing with fresh fetch:', errorMsg);
      }
    }

    // 2. Preload manifest
    console.log('[Preload] Fetching manifest...');
    let response: Response;
    try {
      response = await preloadHLSManifest(hlsUrl);
    } catch (manifestError) {
      console.warn('[Preload] Manifest preload failed (this is non-critical):', manifestError);
      return;
    }

    const manifestContent = await response.text();

    // 3. Cache manifest in IndexedDB for future loads
    if (useIndexedDB) {
      try {
        await cacheManifestInDB(hlsUrl, manifestContent, cacheDuration);
      } catch (cacheError) {
        console.warn('[Preload] Failed to cache manifest:', cacheError);
      }
    }

    // 4. Preload first segments
    console.log('[Preload] Preloading first segments...');
    try {
      await preloadHLSSegments(hlsUrl, segmentCount);
    } catch (segmentError) {
      console.warn('[Preload] Segment preload failed (non-critical):', segmentError);
    }

    console.log('[Preload] Video preloading complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(
      '[Preload] Unexpected video preloading error:',
      `URL: ${hlsUrl || 'UNKNOWN'}`,
      `Message: ${errorMessage || 'UNKNOWN'}`,
      errorStack ? `Stack: ${errorStack}` : ''
    );
    // Graceful fallback - playback will still work, just slower startup
  }
}

/**
 * React hook for video preloading
 */
export function useVideoPreload(hlsUrl: string | null | undefined, enabled: boolean = true) {
  const [isPreloading, setIsPreloading] = (React as any).useState(false);

  (React as any).useEffect(() => {
    if (!enabled || !hlsUrl) return;

    setIsPreloading(true);
    preloadVideoOptimally(hlsUrl)
      .finally(() => setIsPreloading(false))
      .catch(err => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(
          '[useVideoPreload] Preload error:',
          `URL: ${hlsUrl || 'UNKNOWN'}`,
          `Error: ${errorMessage || 'UNKNOWN'}`
        );
      });
  }, [hlsUrl, enabled]);

  return { isPreloading };
}
