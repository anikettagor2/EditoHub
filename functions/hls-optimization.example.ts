/**
 * Cloud Functions: Video Job Processing & HLS Optimization
 * 
 * This updates the existing Cloud Functions to include proper cache metadata
 * when uploading HLS segments and playlists.
 * 
 * Add this to your functions/src/index.ts file in the onRevisionCreated trigger
 */

/**
 * Helper: Set cache control metadata for uploaded files
 * Call this after uploading segments and playlists to Firebase Storage
 */
async function setCacheControlMetadata(
  bucket: FirebaseAdmin.Storage.Bucket,
  filePath: string,
  cacheControl: string,
  contentType: string
): Promise<void> {
  try {
    const file = bucket.file(filePath);
    
    await file.setMetadata({
      cacheControl,
      contentType,
      customMetadata: {
        'hls-optimized': 'true',
        'optimized-at': new Date().toISOString(),
      },
    });

    console.log(`[HLS Metadata] Set cache policy for ${filePath}:`, cacheControl);
  } catch (error) {
    console.error(`[HLS Metadata] Failed to set metadata for ${filePath}:`, error);
    // Don't fail the whole process if metadata update fails
  }
}

/**
 * Cloud Function Code Snippet
 * Add this to the onRevisionCreated trigger after uploading HLS files:
 * 
 * ─────────────────────────────────────────────────────────────────────
 */

// In functions: After uploading master.m3u8
await setCacheControlMetadata(
  bucket,
  `projects/${projectId}/revisions/${revisionId}/hls/master.m3u8`,
  'public, max-age=60, must-revalidate', // Short cache for playlists
  'application/vnd.apple.mpegurl'
);

// After uploading variant playlists
for (const quality of ['1080p', '720p', '480p', '360p']) {
  await setCacheControlMetadata(
    bucket,
    `projects/${projectId}/revisions/${revisionId}/hls/${quality}.m3u8`,
    'public, max-age=60, must-revalidate',
    'application/vnd.apple.mpegurl'
  );
}

// After uploading segments (1 year cache because they're immutable)
const segments = [
  ... // Your segment files
];

for (const segmentPath of segments) {
  await setCacheControlMetadata(
    bucket,
    segmentPath,
    'public, max-age=31536000, immutable', // 1 year cache
    'video/mp2t'
  );
}

// After uploading thumbnail
await setCacheControlMetadata(
  bucket,
  `projects/${projectId}/revisions/${revisionId}/thumbnail.jpg`,
  'public, max-age=604800, immutable', // 7 days cache
  'image/jpeg'
);

/**
 * ─────────────────────────────────────────────────────────────────────
 * Alternative: Batch Metadata Update (Run After Transcoding)
 * 
 * Use this if you want to optimize existing HLS files
 */

export const optimizeExistingHLSMetadata = functions
  .region('us-central1')
  .https.onCall(async (data: { projectId: string; revisionId: string }, context) => {
    const { projectId, revisionId } = data;

    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const bucket = admin.storage().bucket();
    const basePath = `projects/${projectId}/revisions/${revisionId}`;

    const filePolicies = [
      { path: `${basePath}/hls/master.m3u8`, cache: 'public, max-age=60, must-revalidate', type: 'application/vnd.apple.mpegurl' },
      { path: `${basePath}/hls/1080p.m3u8`, cache: 'public, max-age=60, must-revalidate', type: 'application/vnd.apple.mpegurl' },
      { path: `${basePath}/hls/720p.m3u8`, cache: 'public, max-age=60, must-revalidate', type: 'application/vnd.apple.mpegurl' },
      { path: `${basePath}/hls/480p.m3u8`, cache: 'public, max-age=60, must-revalidate', type: 'application/vnd.apple.mpegurl' },
      { path: `${basePath}/hls/360p.m3u8`, cache: 'public, max-age=60, must-revalidate', type: 'application/vnd.apple.mpegurl' },
      { path: `${basePath}/thumbnail.jpg`, cache: 'public, max-age=604800, immutable', type: 'image/jpeg' },
      { path: `${basePath}/original.mp4`, cache: 'public, max-age=31536000, immutable', type: 'video/mp4' },
    ];

    const promises = filePolicies.map(({ path, cache, type }) =>
      setCacheControlMetadata(bucket, path, cache, type)
    );

    await Promise.all(promises);

    return { success: true, message: `Optimized ${filePolicies.length} files` };
  });

/**
 * ─────────────────────────────────────────────────────────────────────
 * CDN Configuration (Firebase Hosting or Google Cloud CDN)
 * 
 * For optimal performance, configure CDN caching headers in your
 * Firebase Hosting rewrites or Cloud CDN:
 */

// firebase.json configuration example:
{
  "hosting": {
    "rewrites": [
      {
        "source": "/projects/:projectId/revisions/:revisionId/hls/**",
        "destination": "/error.html",
        "function": "serveHLSWithCDN"
      }
    ],
    "headers": [
      {
        "source": "/projects/**/hls/**/*.m3u8",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=60, must-revalidate"
          },
          {
            "key": "Access-Control-Allow-Origin",
            "value": "*"
          }
        ]
      },
      {
        "source": "/projects/**/hls/**/*.ts",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          },
          {
            "key": "Access-Control-Allow-Origin",
            "value": "*"
          }
        ]
      }
    ]
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * Summary of Cache Strategies
 * 
 * File Type          | Cache Duration | Reason
 * ─────────────────────────────────────────────────────────────────────
 * Manifest (.m3u8)   | 60 seconds     | Updates can be reflected quickly
 * Segments (.ts)     | 1 year         | Immutable by revision, never change
 * Thumbnail          | 7 days         | May be updated occasionally
 * Original Video     | 1 year         | Immutable by revision
 */
