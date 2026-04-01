/**
 * Aggressive Segment Caching System
 * Caches downloaded video segments in IndexedDB until logout
 * Enables offline playback and bandwidth savings
 */

const DB_NAME = 'editohub-hls-segments';
const STORE_NAME = 'segments';
const VERSION = 1;

interface CachedSegment {
  url: string;
  data: ArrayBuffer;
  timestamp: number;
  contentType: string;
}

/**
 * Initialize IndexedDB for segment caching
 */
export async function getSegmentDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Create store with url as primary key
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        // Index by timestamp for LRU cleanup
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Cache a video segment (called automatically during playback)
 */
export async function cacheSegment(
  url: string,
  data: ArrayBuffer,
  contentType: string = 'video/mp2t'
): Promise<void> {
  try {
    const db = await getSegmentDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put({
      url,
      data,
      timestamp: Date.now(),
      contentType,
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });

    console.log('[Segment Cache] Cached segment:', url.split('/').pop());
  } catch (error) {
    console.warn('[Segment Cache] Failed to cache segment:', error);
  }
}

/**
 * Retrieve a cached segment
 */
export async function getCachedSegment(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await getSegmentDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => {
        const result = request.result as CachedSegment | undefined;
        resolve(result?.data || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[Segment Cache] Failed to retrieve segment:', error);
    return null;
  }
}

/**
 * Check if segment is cached
 */
export async function isSegmentCached(url: string): Promise<boolean> {
  try {
    const db = await getSegmentDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getKey(url);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[Segment Cache] Failed to check segment cache:', error);
    return false;
  }
}

/**
 * Get cache size in bytes
 */
export async function getCacheSize(): Promise<number> {
  try {
    const db = await getSegmentDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      let totalSize = 0;

      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const segment = cursor.value as CachedSegment;
          totalSize += segment.data.byteLength;
          cursor.continue();
        } else {
          const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
          console.log(`[Segment Cache] Total size: ${sizeMB}MB`);
          resolve(totalSize);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[Segment Cache] Failed to get cache size:', error);
    return 0;
  }
}

/**
 * Clear all cached segments (called at logout)
 */
export async function clearSegmentCache(): Promise<void> {
  try {
    const db = await getSegmentDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const clearRequest = store.clear();

    await new Promise((resolve, reject) => {
      clearRequest.onsuccess = () => {
        tx.oncomplete = () => {
          console.log('[Segment Cache] All cached segments cleared');
          resolve(undefined);
        };
        tx.onerror = () => reject(tx.error);
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  } catch (error) {
    console.warn('[Segment Cache] Failed to clear cache:', error);
  }
}

/**
 * Get segment cache statistics
 */
export async function getSegmentCacheStats(): Promise<{
  cacheSize: number;
  cacheCount: number;
  cacheSizeMB: string;
}> {
  try {
    const db = await getSegmentDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      let totalSize = 0;
      let count = 0;

      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const segment = cursor.value as CachedSegment;
          totalSize += segment.data.byteLength;
          count++;
          cursor.continue();
        } else {
          const cacheSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
          resolve({
            cacheSize: totalSize,
            cacheCount: count,
            cacheSizeMB,
          });
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[Segment Cache] Failed to get cache stats:', error);
    return {
      cacheSize: 0,
      cacheCount: 0,
      cacheSizeMB: '0',
    };
  }
}

/**
 * Hook to automatically cache segments during playback
 * Usage: Use with HLS.js event listeners
 */
export function setupSegmentCaching(hls: any): void {
  if (!hls) return;

  // Hook into fragment buffering to cache segments
  hls.on('hlsFragBuffering', () => {
    // Segments are cached via XHR hooks instead
  });

  console.log('[Segment Cache] Setup automatic segment caching');
}

/**
 * Intercept XHR requests to cache segments
 * Add to HLS config xhrSetup
 */
export function createCachingXhrSetup(defaultSetup?: (xhr: XMLHttpRequest, url: string) => void) {
  return (xhr: XMLHttpRequest, url: string) => {
    // Run default setup first
    if (defaultSetup) {
      defaultSetup(xhr, url);
    }

    // Only cache segment files (.ts), not playlists
    if (url.endsWith('.ts')) {
      // Override onreadystatechange to cache on success
      const originalOnReadyStateChange = xhr.onreadystatechange;
      xhr.onreadystatechange = function () {
        if (originalOnReadyStateChange) {
          (originalOnReadyStateChange as any).call(this);
        }

        // Cache segment when loaded (asynchronous, non-blocking)
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
          try {
            const data = xhr.response as ArrayBuffer;
            // Fire and forget - don't await, just cache in background
            cacheSegment(url, data, 'video/mp2t').catch(error => {
              console.warn('[Segment Cache] Failed to cache:', url, error);
            });
          } catch (error) {
            console.warn('[Segment Cache] Failed to cache:', url);
          }
        }
      };
    }
  };
}

/**
 * Implement custom loader that checks cache first
 * Usage: In HLS.js loader configuration
 */
export async function getCachedOrFetch(url: string): Promise<ArrayBuffer> {
  // Check cache first
  const cached = await getCachedSegment(url);
  if (cached) {
    console.log('[Segment Cache] Using cached segment:', url.split('/').pop());
    return cached;
  }

  // If not cached, fetch from network
  console.log('[Segment Cache] Fetching from network:', url.split('/').pop());
  const response = await fetch(url);
  const data = await response.arrayBuffer();

  // Cache for future use
  await cacheSegment(url, data, response.headers.get('content-type') || 'video/mp2t');

  return data;
}
