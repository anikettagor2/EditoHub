import { storage, db } from "@/lib/firebase/config";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc, collection } from "firebase/firestore";
import { VideoJob } from "@/types/schema";
import * as tus from "tus-js-client";
import { safeJsonParse } from "@/lib/utils";

export interface UploadProgress {
  percent: number;
  transferred: number;
  total: number;
  speedBps?: number;
  eta?: number;
  status: 'initial' | 'uploading' | 'processing' | 'complete' | 'error';
}

export interface UploadOptions {
  projectId: string;
  revisionId?: string;
  type: 'raw' | 'revision' | 'asset' | 'pm_file' | 'document';
  onProgress?: (progress: UploadProgress) => void;
  storagePath?: string; // Custom path for Firebase Storage
  onCancelRef?: (cancel: () => void) => void;
}

export class UploadService {
  /**
   * Main entry point for file uploads.
   * Routes to Mux for videos and Firebase Storage for others.
   */
  static async uploadFileUnified(
    file: File,
    projectIdOrOptions: string | UploadOptions,
    onProgressLegacy?: (progress: number) => void,
    maybeOptions?: Partial<UploadOptions>
  ): Promise<string> {
    const isVideo = file.type.startsWith('video/') ||
      ['mp4', 'mov', 'avi', 'mkv', 'webm'].some(ext => file.name.toLowerCase().endsWith(ext));

    let options: UploadOptions;

    if (typeof projectIdOrOptions === 'string') {
      options = {
        projectId: projectIdOrOptions,
        type: maybeOptions?.type || 'asset',
        onProgress: (p) => {
          onProgressLegacy?.(p.percent);
          maybeOptions?.onProgress?.(p);
        },
        ...maybeOptions
      } as UploadOptions;
    } else {
      options = projectIdOrOptions;
    }

    // ROUTING LOGIC:
    // 1. Raw videos and other assets (uploaded by client/pm) -> Firebase Storage
    // 2. Drafts/Revisions (uploaded by editor) -> Mux Storage (for high-speed playback/review)
    console.log(`[UploadService] Unified Upload Start: ${file.name} (${file.size} bytes), Type: ${options.type}, isVideo: ${isVideo}`);

    if (options.type === 'revision' && isVideo) {
      console.log(`[UploadService] Routing to Mux (Draft/Revision Video)`);
      return this.uploadToMux(file, options);
    } else {
      console.log(`[UploadService] Routing to Firebase (${options.type}${isVideo ? ' Video' : ''})`);
      return this.uploadToFirebase(file, options);
    }
  }

  static async uploadFile(
    file: File,
    projectIdOrOptions: string | UploadOptions,
    onProgressLegacy?: (progress: number) => void,
    maybeOptions?: Partial<UploadOptions>
  ): Promise<string> {
    return this.uploadFileUnified(file, projectIdOrOptions, onProgressLegacy, maybeOptions);
  }

  /**
   * Optimized Direct Upload to Mux using tus-js-client (Resumable, Chunked)
   */
  private static async uploadToMux(file: File, options: UploadOptions): Promise<string> {
    const { projectId, revisionId, onProgress, onCancelRef } = options;
    const finalRevisionId = revisionId || doc(collection(db, 'upload_sessions')).id;

    // 1. Get Direct Upload URL from Mux via our API
    const response = await fetch("/api/mux-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, revisionId: finalRevisionId, type: options.type }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[UploadService] API Error:", {
        status: response.status,
        statusText: response.statusText,
        bodySnippet: errorText.substring(0, 500)
      });
      
      if (errorText.includes('<!DOCTYPE html>')) {
        throw new Error(`Server returned HTML instead of JSON. Check if /api/mux-upload-url exists and is working. (Status: ${response.status})`);
      }
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`Failed to create upload: ${response.status} ${response.statusText}`);
      }
      throw new Error(errorData.error || `Failed to create upload: ${response.status} ${response.statusText}`);
    }

    const { uploadUrl, uploadId } = await response.json();

    // 2. Track the job in Firestore
    const videoJob: VideoJob = {
      id: uploadId,
      projectId,
      revisionId: finalRevisionId,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await setDoc(doc(db, "video_jobs", uploadId), videoJob);

    // 3. Start TUS upload
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: uploadUrl,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          filetype: file.type || "video/mp4"
        },
        // Mux handles the URL specifically, tus-js-client should just use it
        uploadUrl: uploadUrl, 
        onError: (error) => {
          console.error("[MuxUpload] TUS Error:", error);
          reject(error);
        },
        onProgress: (bytesSent, bytesTotal) => {
          if (onProgress) {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;
            const speedBps = elapsed > 0 ? bytesSent / elapsed : 0;
            const remainingBytes = bytesTotal - bytesSent;
            const eta = speedBps > 0 ? remainingBytes / speedBps : 0;

            onProgress({
              percent: (bytesSent / bytesTotal) * 100,
              transferred: bytesSent,
              total: bytesTotal,
              speedBps,
              eta,
              status: 'uploading'
            });
          }
        },
        onSuccess: () => {
          if (onProgress) {
            onProgress({
              percent: 100,
              transferred: file.size,
              total: file.size,
              status: 'complete'
            });
          }
          resolve(uploadId);
        }
      });

      if (onCancelRef) {
        onCancelRef(() => upload.abort());
      }

      upload.start();
    });
  }

  /**
   * Upload non-video files to Firebase Storage
   */
  private static async uploadToFirebase(file: File, options: UploadOptions): Promise<string> {
    const { projectId, type, onProgress, storagePath, onCancelRef } = options;

    let finalPath = storagePath;
    if (!finalPath) {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      finalPath = `projects/${projectId}/${type}/${fileName}`;
    }

    const storageRef = ref(storage, finalPath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (onProgress) {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;
            const speedBps = elapsed > 0 ? snapshot.bytesTransferred / elapsed : 0;
            const remainingBytes = snapshot.totalBytes - snapshot.bytesTransferred;
            const eta = speedBps > 0 ? remainingBytes / speedBps : 0;

            onProgress({
              percent: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
              transferred: snapshot.bytesTransferred,
              total: snapshot.totalBytes,
              speedBps,
              eta,
              status: 'uploading'
            });
          }
        },
        (error) => reject(error),
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          if (onProgress) {
            onProgress({
              percent: 100,
              transferred: file.size,
              total: file.size,
              status: 'complete'
            });
          }
          resolve(downloadUrl);
        }
      );

      if (onCancelRef) {
        onCancelRef(() => uploadTask.cancel());
      }
    });
  }

  /**
   * Formatting helpers
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  static formatSpeed(bps: number): string {
    return `${this.formatBytes(bps)}/s`;
  }

  static formatEta(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return "--";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
}
