/**
 * Video Metadata Caching System
 * Uses IndexedDB for persistent, efficient caching of video metadata
 * Reduces Firestore reads by caching video document data
 */

const DB_NAME = 'EditohubVideoCache';
const DB_VERSION = 1;
const METADATA_STORE = 'videoMetadata';
const THUMBNAIL_STORE = 'videoThumbnails';

export interface VideoMetadataCache {
  id: string;
  videoId: string;
  title: string;
  description?: string;
  duration: number;
  fileSize: number;
  thumbnailUrl?: string;
  storagePath: string;
  optimizedPath?: string;
  createdAt: number;
  updatedAt: number;
  cacheShouldExpireAt: number;
  tags?: string[];
  isProcessed?: boolean;
}

export interface ThumbnailCache {
  videoId: string;
  thumbnailBlob: Blob;
  createdAt: number;
  cacheShouldExpireAt: number;
}

/**
 * Initialize IndexedDB database
 */
function getDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create metadata store
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        metadataStore.createIndex('videoId', 'videoId', { unique: false });
        metadataStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Create thumbnail store
      if (!db.objectStoreNames.contains(THUMBNAIL_STORE)) {
        const thumbnailStore = db.createObjectStore(THUMBNAIL_STORE, { keyPath: 'videoId' });
        thumbnailStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Cache video metadata
 */
export async function cacheVideoMetadata(
  metadata: Omit<VideoMetadataCache, 'cacheShouldExpireAt'>,
  ttlHours: number = 24
): Promise<void> {
  try {
    const db = await getDatabase();
    const cacheEntry: VideoMetadataCache = {
      ...metadata,
      cacheShouldExpireAt: Date.now() + ttlHours * 60 * 60 * 1000,
    };

    const request = db
      .transaction(METADATA_STORE, 'readwrite')
      .objectStore(METADATA_STORE)
      .put(cacheEntry);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[VideoMetadataCache] Metadata cached:', metadata.videoId);
        resolve();
      };
    });
  } catch (error) {
    console.warn('[VideoMetadataCache] Failed to cache metadata:', error);
  }
}

/**
 * Retrieve cached video metadata
 */
export async function getCachedVideoMetadata(
  videoId: string
): Promise<VideoMetadataCache | null> {
  try {
    const db = await getDatabase();
    const index = db
      .transaction(METADATA_STORE, 'readonly')
      .objectStore(METADATA_STORE)
      .index('videoId');

    const request = index.get(videoId);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          resolve(null);
          return;
        }

        // Check if cache has expired
        if (Date.now() > result.cacheShouldExpireAt) {
          // Delete expired entry silently
          db.transaction(METADATA_STORE, 'readwrite')
            .objectStore(METADATA_STORE)
            .delete(result.id)
            .onerror = () => console.warn('[VideoMetadataCache] Failed to delete expired entry');

          console.log('[VideoMetadataCache] Metadata cache expired:', videoId);
          resolve(null);
          return;
        }

        console.log('[VideoMetadataCache] Cache hit:', videoId);
        resolve(result);
      };
    });
  } catch (error) {
    console.warn('[VideoMetadataCache] Failed to retrieve metadata:', error);
    return null;
  }
}

/**
 * Cache video thumbnail
 */
export async function cacheThumbnail(
  videoId: string,
  thumbnailBlob: Blob,
  ttlHours: number = 24
): Promise<void> {
  try {
    const db = await getDatabase();
    const cacheEntry: ThumbnailCache = {
      videoId,
      thumbnailBlob,
      createdAt: Date.now(),
      cacheShouldExpireAt: Date.now() + ttlHours * 60 * 60 * 1000,
    };

    const request = db
      .transaction(THUMBNAIL_STORE, 'readwrite')
      .objectStore(THUMBNAIL_STORE)
      .put(cacheEntry);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[VideoMetadataCache] Thumbnail cached:', videoId);
        resolve();
      };
    });
  } catch (error) {
    console.warn('[VideoMetadataCache] Failed to cache thumbnail:', error);
  }
}

/**
 * Retrieve cached thumbnail
 */
export async function getCachedThumbnail(videoId: string): Promise<string | null> {
  try {
    const db = await getDatabase();
    const request = db
      .transaction(THUMBNAIL_STORE, 'readonly')
      .objectStore(THUMBNAIL_STORE)
      .get(videoId);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          resolve(null);
          return;
        }

        // Check if cache has expired
        if (Date.now() > result.cacheShouldExpireAt) {
          db.transaction(THUMBNAIL_STORE, 'readwrite')
            .objectStore(THUMBNAIL_STORE)
            .delete(videoId)
            .onerror = () =>
            console.warn('[VideoMetadataCache] Failed to delete expired thumbnail');

          resolve(null);
          return;
        }

        const url = URL.createObjectURL(result.thumbnailBlob);
        console.log('[VideoMetadataCache] Thumbnail cache hit:', videoId);
        resolve(url);
      };
    });
  } catch (error) {
    console.warn('[VideoMetadataCache] Failed to retrieve thumbnail:', error);
    return null;
  }
}

/**
 * Check if metadata is cached and valid
 */
export async function isVideoMetadataCached(videoId: string): Promise<boolean> {
  const metadata = await getCachedVideoMetadata(videoId);
  return metadata !== null;
}

/**
 * Clear metadata cache for a specific video
 */
export async function clearVideoMetadataCache(videoId: string): Promise<void> {
  try {
    const db = await getDatabase();
    const index = db
      .transaction(METADATA_STORE, 'readonly')
      .objectStore(METADATA_STORE)
      .index('videoId');

    const request = index.get(videoId);

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        db.transaction(METADATA_STORE, 'readwrite')
          .objectStore(METADATA_STORE)
          .delete(result.id);
      }
    };

    console.log('[VideoMetadataCache] Cache cleared:', videoId);
  } catch (error) {
    console.warn('[VideoMetadataCache] Failed to clear cache:', error);
  }
}

/**
 * Clear all metadata caches
 */
export async function clearAllVideoMetadataCaches(): Promise<void> {
  try {
    const db = await getDatabase();

    // Clear metadata store
    const metadataRequest = db
      .transaction(METADATA_STORE, 'readwrite')
      .objectStore(METADATA_STORE)
      .clear();

    // Clear thumbnail store
    const thumbnailRequest = db
      .transaction(THUMBNAIL_STORE, 'readwrite')
      .objectStore(THUMBNAIL_STORE)
      .clear();

    return new Promise((resolve, reject) => {
      let completed = 0;
      const complete = () => {
        completed++;
        if (completed === 2) {
          console.log('[VideoMetadataCache] All caches cleared');
          resolve();
        }
      };

      metadataRequest.onerror = () => reject(metadataRequest.error);
      metadataRequest.onsuccess = complete;

      thumbnailRequest.onerror = () => reject(thumbnailRequest.error);
      thumbnailRequest.onsuccess = complete;
    });
  } catch (error) {
    console.warn('[VideoMetadataCache] Failed to clear all caches:', error);
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredMetadataCaches(): Promise<number> {
  try {
    const db = await getDatabase();
    const now = Date.now();
    let deleted = 0;

    // Get all metadata entries
    const metadataTransaction = db.transaction(METADATA_STORE, 'readwrite');
    const metadataStore = metadataTransaction.objectStore(METADATA_STORE);
    const metadataRequest = metadataStore.getAll();

    return new Promise((resolve, reject) => {
      metadataRequest.onerror = () => reject(metadataRequest.error);
      metadataRequest.onsuccess = () => {
        const entries = metadataRequest.result;
        entries.forEach((entry: VideoMetadataCache) => {
          if (now > entry.cacheShouldExpireAt) {
            metadataStore.delete(entry.id);
            deleted++;
          }
        });

        // Also cleanup thumbnails
        const thumbnailTransaction = db.transaction(THUMBNAIL_STORE, 'readwrite');
        const thumbnailStore = thumbnailTransaction.objectStore(THUMBNAIL_STORE);
        const thumbnailRequest = thumbnailStore.getAll();

        thumbnailRequest.onsuccess = () => {
          const thumbnails = thumbnailRequest.result;
          thumbnails.forEach((thumbnail: ThumbnailCache) => {
            if (now > thumbnail.cacheShouldExpireAt) {
              thumbnailStore.delete(thumbnail.videoId);
              deleted++;
            }
          });

          console.log('[VideoMetadataCache] Cleanup completed, removed:', deleted);
          resolve(deleted);
        };

        thumbnailRequest.onerror = () => reject(thumbnailRequest.error);
      };
    });
  } catch (error) {
    console.warn('[VideoMetadataCache] Failed to cleanup:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getVideoMetadataCacheStats(): Promise<{
  metadataCount: number;
  thumbnailCount: number;
  expiredCount: number;
}> {
  try {
    const db = await getDatabase();
    const now = Date.now();
    let metadataCount = 0;
    let thumbnailCount = 0;
    let expiredCount = 0;

    const metadataTransaction = db.transaction(METADATA_STORE, 'readonly');
    const metadataStore = metadataTransaction.objectStore(METADATA_STORE);
    const metadataRequest = metadataStore.getAll();

    return new Promise((resolve, reject) => {
      metadataRequest.onerror = () => reject(metadataRequest.error);
      metadataRequest.onsuccess = () => {
        const entries = metadataRequest.result;
        metadataCount = entries.length;
        entries.forEach((entry: VideoMetadataCache) => {
          if (now > entry.cacheShouldExpireAt) {
            expiredCount++;
          }
        });

        const thumbnailTransaction = db.transaction(THUMBNAIL_STORE, 'readonly');
        const thumbnailStore = thumbnailTransaction.objectStore(THUMBNAIL_STORE);
        const thumbnailRequest = thumbnailStore.getAll();

        thumbnailRequest.onsuccess = () => {
          thumbnailCount = thumbnailRequest.result.length;
          resolve({ metadataCount, thumbnailCount, expiredCount });
        };

        thumbnailRequest.onerror = () => reject(thumbnailRequest.error);
      };
    });
  } catch (error) {
    console.warn('[VideoMetadataCache] Failed to get stats:', error);
    return { metadataCount: 0, thumbnailCount: 0, expiredCount: 0 };
  }
}
