/**
 * Video Upload Optimization Script
 * Handles compression, HLS conversion, and Firebase Storage upload
 */

import { getStorage, ref, uploadBytes, getDownloadURL, UploadMetadata } from 'firebase/storage';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Configure FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface VideoUploadOptions {
  file: File;
  projectId: string;
  userId: string;
  onProgress?: (progress: number) => void;
  onQualityGenerated?: (quality: string) => void;
}

interface VideoProcessingResult {
  originalUrl: string;
  hlsUrl: string;
  thumbnailUrl: string;
  qualities: string[];
  duration: number;
  size: number;
}

class VideoUploadOptimizer {
  private storage = getStorage();
  private db = getFirestore();

  /**
   * Main upload method with compression and HLS conversion
   */
  async uploadVideo(options: VideoUploadOptions): Promise<VideoProcessingResult> {
    const { file, projectId, userId, onProgress, onQualityGenerated } = options;

    // Create temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-upload-'));
    const inputPath = path.join(tempDir, 'input.mp4');
    const outputDir = path.join(tempDir, 'hls');

    try {
      // Write input file
      const buffer = await file.arrayBuffer();
      await fs.writeFile(inputPath, Buffer.from(buffer));

      // Get video info
      const videoInfo = await this.getVideoInfo(inputPath);

      // Compress and generate HLS
      const hlsResult = await this.generateHLSStream({
        inputPath,
        outputDir,
        onProgress,
        onQualityGenerated,
      });

      // Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(inputPath, tempDir);

      // Upload all files to Firebase Storage
      const uploadResult = await this.uploadToFirebase({
        projectId,
        userId,
        files: {
          original: inputPath,
          hls: hlsResult,
          thumbnail: thumbnailPath,
        },
        onProgress,
      });

      // Update project document
      await this.updateProjectDocument(projectId, uploadResult);

      return {
        originalUrl: uploadResult.originalUrl,
        hlsUrl: uploadResult.hlsUrl,
        thumbnailUrl: uploadResult.thumbnailUrl,
        qualities: hlsResult.qualities,
        duration: videoInfo.duration,
        size: videoInfo.size,
      };

    } finally {
      // Cleanup
      await this.cleanup(tempDir);
    }
  }

  /**
   * Get video information
   */
  private async getVideoInfo(inputPath: string): Promise<{ duration: number; size: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);

        const duration = metadata.format.duration || 0;
        const size = metadata.format.size || 0;

        resolve({ duration, size });
      });
    });
  }

  /**
   * Generate HLS stream with multiple qualities
   */
  private async generateHLSStream(options: {
    inputPath: string;
    outputDir: string;
    onProgress?: (progress: number) => void;
    onQualityGenerated?: (quality: string) => void;
  }): Promise<{ masterPath: string; qualities: string[] }> {
    const { inputPath, outputDir, onProgress, onQualityGenerated } = options;

    await fs.mkdir(outputDir, { recursive: true });

    // Define quality presets
    const qualities = [
      { name: '360p', width: 640, height: 360, bitrate: '800k' },
      { name: '480p', width: 854, height: 480, bitrate: '1200k' },
      { name: '720p', width: 1280, height: 720, bitrate: '2400k' },
      { name: '1080p', width: 1920, height: 1080, bitrate: '4800k' },
    ];

    const variantPaths: string[] = [];

    // Generate each quality
    for (const quality of qualities) {
      const qualityDir = path.join(outputDir, quality.name);
      await fs.mkdir(qualityDir, { recursive: true });

      const outputPath = path.join(qualityDir, 'index.m3u8');

      await this.transcodeToHLS({
        inputPath,
        outputPath,
        quality,
        onProgress: (progress) => {
          if (onProgress) {
            // Calculate overall progress (25% per quality)
            const qualityIndex = qualities.indexOf(quality);
            const baseProgress = (qualityIndex / qualities.length) * 100;
            const qualityProgress = progress * 0.25;
            onProgress(baseProgress + qualityProgress);
          }
        },
      });

      variantPaths.push(`${quality.name}/index.m3u8`);

      if (onQualityGenerated) {
        onQualityGenerated(quality.name);
      }
    }

    // Generate master playlist
    const masterContent = this.generateMasterPlaylist(qualities, variantPaths);
    const masterPath = path.join(outputDir, 'master.m3u8');
    await fs.writeFile(masterPath, masterContent);

    return {
      masterPath,
      qualities: qualities.map(q => q.name),
    };
  }

  /**
   * Transcode video to HLS format
   */
  private async transcodeToHLS(options: {
    inputPath: string;
    outputPath: string;
    quality: { width: number; height: number; bitrate: string };
    onProgress?: (progress: number) => void;
  }): Promise<void> {
    const { inputPath, outputPath, quality, onProgress } = options;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', `scale=${quality.width}:${quality.height}:force_original_aspect_ratio=decrease,pad=${quality.width}:${quality.height}:(ow-iw)/2:(oh-ih)/2`,
          '-c:v', 'libx264',
          '-b:v', quality.bitrate,
          '-c:a', 'aac',
          '-b:a', '128k',
          '-hls_time', '6',
          '-hls_list_size', '0',
          '-hls_segment_filename', path.join(path.dirname(outputPath), 'seg_%03d.ts'),
          '-f', 'hls',
        ])
        .output(outputPath)
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(progress.percent / 100);
          }
        })
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  /**
   * Generate master playlist
   */
  private generateMasterPlaylist(qualities: any[], variantPaths: string[]): string {
    const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];

    qualities.forEach((quality, index) => {
      const bandwidth = parseInt(quality.bitrate) * 1000; // Convert to bps
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.width}x${quality.height}`);
      lines.push(variantPaths[index]);
    });

    return lines.join('\n');
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(inputPath: string, tempDir: string): Promise<string> {
    const thumbnailPath = path.join(tempDir, 'thumbnail.jpg');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(5) // Seek to 5 seconds
        .frames(1)
        .outputOptions('-q:v', '3')
        .output(thumbnailPath)
        .on('end', () => resolve(thumbnailPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Upload files to Firebase Storage
   */
  private async uploadToFirebase(options: {
    projectId: string;
    userId: string;
    files: { original: string; hls: { masterPath: string; qualities: string[] }; thumbnail: string };
    onProgress?: (progress: number) => void;
  }): Promise<{
    originalUrl: string;
    hlsUrl: string;
    thumbnailUrl: string;
  }> {
    const { projectId, userId, files, onProgress } = options;

    const uploadPromises: Promise<void>[] = [];
    let completedUploads = 0;

    const updateProgress = () => {
      completedUploads++;
      if (onProgress) {
        onProgress((completedUploads / 4) * 100); // 4 files total
      }
    };

    // Upload original video
    const originalRef = ref(this.storage, `projects/${projectId}/videos/original_${Date.now()}.mp4`);
    const originalMetadata: UploadMetadata = {
      contentType: 'video/mp4',
      customMetadata: {
        uploadedBy: userId,
        projectId,
      },
      cacheControl: 'public,max-age=31536000',
    };

    uploadPromises.push(
      uploadBytes(originalRef, await fs.readFile(files.original), originalMetadata).then(updateProgress)
    );

    // Upload HLS files
    const hlsDir = path.dirname(files.hls.masterPath);
    const hlsFiles = await this.getAllFiles(hlsDir);

    for (const filePath of hlsFiles) {
      const relativePath = path.relative(hlsDir, filePath);
      const storagePath = `projects/${projectId}/hls/${Date.now()}/${relativePath}`;
      const fileRef = ref(this.storage, storagePath);

      const contentType = filePath.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T';
      const metadata: UploadMetadata = {
        contentType,
        cacheControl: 'public,max-age=31536000',
      };

      uploadPromises.push(
        uploadBytes(fileRef, await fs.readFile(filePath), metadata).then(updateProgress)
      );
    }

    // Upload thumbnail
    const thumbnailRef = ref(this.storage, `projects/${projectId}/thumbnails/${Date.now()}.jpg`);
    const thumbnailMetadata: UploadMetadata = {
      contentType: 'image/jpeg',
      cacheControl: 'public,max-age=31536000',
    };

    uploadPromises.push(
      uploadBytes(thumbnailRef, await fs.readFile(files.thumbnail), thumbnailMetadata).then(updateProgress)
    );

    await Promise.all(uploadPromises);

    // Get download URLs
    const [originalUrl, hlsUrl, thumbnailUrl] = await Promise.all([
      getDownloadURL(originalRef),
      getDownloadURL(ref(this.storage, `projects/${projectId}/hls/${Date.now()}/master.m3u8`)),
      getDownloadURL(thumbnailRef),
    ]);

    return { originalUrl, hlsUrl, thumbnailUrl };
  }

  /**
   * Get all files in directory recursively
   */
  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }

    await scan(dirPath);
    return files;
  }

  /**
   * Update project document with video URLs
   */
  private async updateProjectDocument(
    projectId: string,
    urls: { originalUrl: string; hlsUrl: string; thumbnailUrl: string }
  ): Promise<void> {
    const projectRef = doc(this.db, 'projects', projectId);
    await updateDoc(projectRef, {
      videoUrl: urls.originalUrl,
      hlsUrl: urls.hlsUrl,
      thumbnailUrl: urls.thumbnailUrl,
      videoProcessed: true,
      processedAt: new Date(),
    });
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
  }
}

// Export singleton instance
export const videoUploadOptimizer = new VideoUploadOptimizer();

// Export types
export type { VideoUploadOptions, VideoProcessingResult };