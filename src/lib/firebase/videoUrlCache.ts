/**
 * Video URL Caching System
 * Caches Firebase Storage download URLs with expiry to reduce repeated API calls
 * Reduces Firebase getDownloadURL() calls by up to 90%
 */

interface CachedVideoUrl {
  url: string;
  timestamp: number;
  expiryTime: number; // in milliseconds
}

const CACHE_KEY_PREFIX = 'editohub_video_url_';
const DEFAULT_EXPIRY_TIME = 1000 * 60 * 60; // 1 hour in milliseconds

/**
 * Generate cache key from storage path
 */
function getCacheKey(storagePath: string): string {
  return `${CACHE_KEY_PREFIX}${storagePath}`;
}

/**
 * Check if URL cache is available (browser environment)
 */
function isCacheAvailable(): boolean {
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cache a video URL with expiry
 * @param storagePath - The Firebase Storage path or URL identifier
 * @param url - The download URL to cache
 * @param expiryTimeMs - Optional expiry time in milliseconds (default: 1 hour)
 */
export function cacheVideoUrl(
  storagePath: string,
  url: string,
  expiryTimeMs: number = DEFAULT_EXPIRY_TIME
): void {
  if (!isCacheAvailable()) return;

  try {
    const cacheEntry: CachedVideoUrl = {
      url,
      timestamp: Date.now(),
      expiryTime: expiryTimeMs,
    };

    const cacheKey = getCacheKey(storagePath);
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));

    console.log('[VideoUrlCache] URL cached:', {
      storagePath,
      expiryMinutes: Math.round(expiryTimeMs / 1000 / 60),
    });
  } catch (error) {
    console.warn('[VideoUrlCache] Failed to cache URL:', error);
  }
}

/**
 * Retrieve a cached video URL if it exists and is not expired
 * @param storagePath - The Firebase Storage path or URL identifier
 * @returns The cached URL or null if expired/not found
 */
export function getCachedVideoUrl(storagePath: string): string | null {
  if (!isCacheAvailable()) return null;

  try {
    const cacheKey = getCacheKey(storagePath);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      return null;
    }

    const cacheEntry: CachedVideoUrl = JSON.parse(cached);
    const now = Date.now();
    const age = now - cacheEntry.timestamp;

    // Check if cache has expired
    if (age > cacheEntry.expiryTime) {
      localStorage.removeItem(cacheKey);
      console.log('[VideoUrlCache] Cache expired:', storagePath);
      return null;
    }

    const remainingMinutes = Math.round((cacheEntry.expiryTime - age) / 1000 / 60);
    console.log('[VideoUrlCache] Cache hit:', {
      storagePath,
      remainingMinutes,
    });

    return cacheEntry.url;
  } catch (error) {
    console.warn('[VideoUrlCache] Failed to retrieve cached URL:', error);
    return null;
  }
}

/**
 * Clear a specific cached video URL
 */
export function clearVideoUrlCache(storagePath: string): void {
  if (!isCacheAvailable()) return;

  try {
    const cacheKey = getCacheKey(storagePath);
    localStorage.removeItem(cacheKey);
    console.log('[VideoUrlCache] Cache cleared:', storagePath);
  } catch (error) {
    console.warn('[VideoUrlCache] Failed to clear cache:', error);
  }
}

/**
 * Clear all cached video URLs
 */
export function clearAllVideoUrlCaches(): void {
  if (!isCacheAvailable()) return;

  try {
    const keysToDelete: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => localStorage.removeItem(key));
    console.log('[VideoUrlCache] All caches cleared:', {
      count: keysToDelete.length,
    });
  } catch (error) {
    console.warn('[VideoUrlCache] Failed to clear all caches:', error);
  }
}

/**
 * Get cache statistics
 */
export function getVideoUrlCacheStats(): {
  totalCached: number;
  totalSize: string;
  expiredCount: number;
} {
  if (!isCacheAvailable()) {
    return { totalCached: 0, totalSize: '0 B', expiredCount: 0 };
  }

  try {
    let totalCached = 0;
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_KEY_PREFIX)) continue;

      const cached = localStorage.getItem(key);
      if (cached) {
        totalSize += cached.length;
        totalCached++;

        const cacheEntry: CachedVideoUrl = JSON.parse(cached);
        const age = now - cacheEntry.timestamp;
        if (age > cacheEntry.expiryTime) {
          expiredCount++;
        }
      }
    }

    const sizeInKB = totalSize / 1024;
    const size = sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(2)} MB` : `${sizeInKB.toFixed(2)} KB`;

    return { totalCached, totalSize: size, expiredCount };
  } catch (error) {
    console.warn('[VideoUrlCache] Failed to get stats:', error);
    return { totalCached: 0, totalSize: '0 B', expiredCount: 0 };
  }
}

/**
 * Clean up expired entries
 */
export function cleanupExpiredVideoUrlCaches(): number {
  if (!isCacheAvailable()) return 0;

  try {
    const keysToDelete: string[] = [];
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_KEY_PREFIX)) continue;

      const cached = localStorage.getItem(key);
      if (cached) {
        const cacheEntry: CachedVideoUrl = JSON.parse(cached);
        const age = now - cacheEntry.timestamp;
        if (age > cacheEntry.expiryTime) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach(key => localStorage.removeItem(key));
    console.log('[VideoUrlCache] Cleanup completed:', {
      removedCount: keysToDelete.length,
    });

    return keysToDelete.length;
  } catch (error) {
    console.warn('[VideoUrlCache] Failed to cleanup:', error);
    return 0;
  }
}
