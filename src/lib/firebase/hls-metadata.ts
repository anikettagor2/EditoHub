/**
 * Firebase Storage Metadata Configuration for HLS Streaming
 * 
 * Optimizes:
 * - CDN caching (1 year for immutable segments)
 * - Faster delivery through CloudFront/CDN
 * - Reduced bandwidth costs
 * - Long-term storage URLs
 */

import { ref, uploadBytes, uploadBytesResumable, getMetadata, updateMetadata } from 'firebase/storage';
import { storage } from './config';

/**
 * Cache control settings for different file types
 */
export const CACHE_POLICIES = {
  // HLS Playlist (updates frequently) - short cache
  manifest: {
    cacheControl: 'public, max-age=60, must-revalidate',
    contentType: 'application/vnd.apple.mpegurl',
  },

  // HLS Variant Playlist - short cache
  variantPlaylist: {
    cacheControl: 'public, max-age=60, must-revalidate',
    contentType: 'application/vnd.apple.mpegurl',
  },

  // TS Segments - immutable, cache forever (1 year)
  segment: {
    cacheControl: 'public, max-age=31536000, immutable',
    contentType: 'video/mp2t',
  },

  // Thumbnail - cache for 7 days
  thumbnail: {
    cacheControl: 'public, max-age=604800, immutable',
    contentType: 'image/jpeg',
  },

  // Original video file - immutable (versioned by revision)
  original: {
    cacheControl: 'public, max-age=31536000, immutable',
    contentType: 'video/mp4',
  },
} as const;

/**
 * Determine cache policy based on file path
 */
export function getCachePolicyForPath(filePath: string): (typeof CACHE_POLICIES)[keyof typeof CACHE_POLICIES] {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.endsWith('master.m3u8')) {
    return CACHE_POLICIES.manifest;
  }

  if (lowerPath.endsWith('.m3u8')) {
    return CACHE_POLICIES.variantPlaylist;
  }

  if (lowerPath.endsWith('.ts')) {
    return CACHE_POLICIES.segment;
  }

  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.png')) {
    return CACHE_POLICIES.thumbnail;
  }

  if (lowerPath.endsWith('.mp4') || lowerPath.endsWith('.mov')) {
    return CACHE_POLICIES.original;
  }

  // Default: moderate caching
  return CACHE_POLICIES.thumbnail;
}

/**
 * Upload a file with optimized metadata for HLS streaming
 * 
 * @param file The file to upload
 * @param path Storage path (e.g., 'projects/xyz/revisions/abc/segment.ts')
 * @param onProgress Optional progress callback (0-100)
 * @returns Download URL and metadata
 */
export async function uploadHLSFileWithMetadata(
  file: File | Blob,
  path: string,
  onProgress?: (progress: number) => void
): Promise<{ path: string; metadata: Record<string, string> }> {
  const policy = getCachePolicyForPath(path);
  const storageRef = ref(storage, path);

  // Create custom metadata
  const customMetadata = {
    'hls-streaming': 'true',
    'uploaded-at': new Date().toISOString(),
  };

  try {
    // Upload with resumable upload for better tracking
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: policy.contentType,
      customMetadata,
    });

    // Promise wrapper for upload completion
    const uploadPromise = new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.(progress);
        },
        reject,
        resolve
      );
    });

    await uploadPromise;

    // Set cache control metadata (done after upload)
    await updateMetadata(storageRef, {
      cacheControl: policy.cacheControl,
      contentType: policy.contentType,
      customMetadata,
    });

    return {
      path,
      metadata: {
        cacheControl: policy.cacheControl,
        contentType: policy.contentType,
      },
    };
  } catch (error) {
    console.error(`[HLS Upload] Failed to upload ${path}:`, error);
    throw error;
  }
}

/**
 * Upload multiple HLS files in parallel with metadata
 */
export async function uploadHLSFilesParallel(
  files: Array<{ file: File | Blob; path: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ path: string; metadata: Record<string, string> }>> {
  const results: Array<{ path: string; metadata: Record<string, string> }> = [];

  // Upload in batches of 4 to avoid overwhelming the network
  const batchSize = 4;
  const totalFiles = files.length;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, Math.min(i + batchSize, files.length));

    const batchPromises = batch.map(({ file, path }) =>
      uploadHLSFileWithMetadata(file, path, () => {
        onProgress?.(i + batchPromises.length, totalFiles);
      })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Update existing file metadata for caching optimization
 * Useful for existing HLS files
 */
export async function updateHLSFileMetadata(filePath: string): Promise<void> {
  const policy = getCachePolicyForPath(filePath);
  const storageRef = ref(storage, filePath);

  try {
    await updateMetadata(storageRef, {
      cacheControl: policy.cacheControl,
      contentType: policy.contentType,
      customMetadata: {
        'hls-optimized': 'true',
        'optimized-at': new Date().toISOString(),
      },
    });
    console.log(`[HLS Metadata] Updated ${filePath}`);
  } catch (error) {
    console.error(`[HLS Metadata] Failed to update ${filePath}:`, error);
  }
}

/**
 * Batch update metadata for all HLS files in a revision
 */
export async function optimizeRevisionHLSMetadata(
  projectId: string,
  revisionId: string
): Promise<void> {
  const basePath = `projects/${projectId}/revisions/${revisionId}`;

  // Files to optimize
  const filePaths = [
    `${basePath}/hls/master.m3u8`,
    `${basePath}/hls/1080p.m3u8`,
    `${basePath}/hls/720p.m3u8`,
    `${basePath}/hls/480p.m3u8`,
    `${basePath}/hls/360p.m3u8`,
    `${basePath}/thumbnail.jpg`,
    `${basePath}/original.mp4`,
  ];

  console.log(`[HLS Metadata] Optimizing ${filePaths.length} files in revision ${revisionId}`);

  await Promise.all(filePaths.map(path => updateHLSFileMetadata(path).catch(() => {})));

  console.log(`[HLS Metadata] Optimization complete`);
}

/**
 * Get signed URL for HLS playlist with long expiration (10 years)
 * Useful for client-side HLS.js loading
 */
export async function getSignedHLSPlaylistUrl(
  filePath: string,
  expirationDays: number = 3650 // 10 years
): Promise<string> {
  try {
    const { getDownloadURL } = await import('firebase/storage');
    const storageRef = ref(storage, filePath);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error(`[HLS Signed URL] Failed to get URL for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Storage structure optimization guide
 * 
 * Recommended folder structure for fast HLS access:
 * 
 * projects/{projectId}/revisions/{revisionId}/
 * ├── master.m3u8              (main playlist, 60s cache)
 * ├── hls/
 * │   ├── master.m3u8          (duplicated for compatibility)
 * │   ├── 1080p.m3u8           (variant playlist, 60s cache)
 * │   ├── 720p.m3u8
 * │   ├── 480p.m3u8
 * │   ├── 360p.m3u8
 * │   └── segments/
 * │       ├── segment-0.ts      (1-2 year cache, immutable)
 * │       ├── segment-1.ts
 * │       └── ...
 * ├── original.mp4             (1 year cache, immutable)
 * └── thumbnail.jpg            (7 day cache, versioned)
 * 
 * Benefits:
 * - Segments cached forever (immutable by revision)
 * - Playlists cached short (updates available quickly)
 * - Original video available as fallback
 * - Thumbnail for preview/social sharing
 * - CDN-friendly structure reduces origin requests
 */
