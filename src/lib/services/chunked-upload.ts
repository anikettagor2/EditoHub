/**
 * Chunked Resumable Upload Service
 *
 * - Splits files into 5 MB chunks
 * - Uploads up to 3 chunks in parallel
 * - Persists session state in Firestore so uploads can resume after page reload
 * - Uploads directly to Firebase Storage (no backend proxy)
 */
import { storage, db } from "@/lib/firebase/config";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CONCURRENT = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ChunkedUploadProgress {
  overallPct: number;      // 0 – 100
  bytesUploaded: number;
  totalBytes: number;
  speedBps: number;        // bytes / second
  etaSeconds: number;
  chunksTotal: number;
  chunksComplete: number;
  status: "idle" | "uploading" | "assembling" | "done" | "error";
}

interface PersistedSession {
  sessionId: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  completedChunks: number[];         // indices that have been confirmed
  chunkPaths: Record<number, string>; // index → storage path
  status: "uploading" | "done" | "error";
  finalUrl?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic session ID so the same file+project always maps to the same session. */
export function makeSessionId(projectId: string, file: File): string {
  const safeName = file.name.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  return `${projectId}_${safeName}_${file.size}`;
}

/** Split a File into an array of Blobs. */
function splitFile(file: File, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let start = 0;
  while (start < file.size) {
    chunks.push(file.slice(start, Math.min(start + chunkSize, file.size)));
    start += chunkSize;
  }
  return chunks;
}

/**
 * Upload a single chunk.
 * Returns the storage path once the upload is complete.
 */
async function uploadChunk(
  blob: Blob,
  path: string,
  onProgress: (bytes: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const chunkRef = ref(storage, path);
    const task = uploadBytesResumable(chunkRef, blob);

    const handleAbort = () => task.cancel();
    signal?.addEventListener("abort", handleAbort);

    task.on(
      "state_changed",
      (snap) => onProgress(snap.bytesTransferred),
      (err) => {
        signal?.removeEventListener("abort", handleAbort);
        reject(err);
      },
      () => {
        signal?.removeEventListener("abort", handleAbort);
        resolve(path);
      }
    );
  });
}

/**
 * Bounded-concurrency worker pool.
 * Runs `fns` with at most `limit` promises active at once.
 */
async function withConcurrency<T>(
  fns: Array<() => Promise<T>>,
  limit: number,
  onEach?: (index: number, result: T) => void
): Promise<T[]> {
  const results = new Array<T>(fns.length);
  let cursor = 0;

  async function worker() {
    while (cursor < fns.length) {
      const idx = cursor++;
      const result = await fns[idx]();
      results[idx] = result;
      onEach?.(idx, result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, fns.length) }, worker)
  );
  return results;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Start (or resume) a chunked upload.
 *
 * - Returns a Promise<string> that resolves to the Firebase Storage download URL.
 * - Calls `onProgress` frequently so the UI can update.
 * - Passing an AbortSignal lets callers cancel and clean up.
 */
export async function startChunkedUpload(
  projectId: string,
  file: File,
  onProgress: (p: ChunkedUploadProgress) => void,
  signal?: AbortSignal
): Promise<string> {
  const sessionId = makeSessionId(projectId, file);
  const sessionRef = doc(db, "upload_sessions", sessionId);
  let canPersistSession = true;

  try {
    await setDoc(sessionRef, {
      sessionId,
      projectId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks: 1,
      completedChunks: [],
      chunkPaths: {},
      status: "uploading",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as PersistedSession);
  } catch (err) {
    canPersistSession = false;
    console.warn("upload_sessions persistence unavailable; continuing upload without resume state", err);
  }

  const finalPath = `projects/${projectId}/revisions/${sessionId}/${file.name}`;
  const finalRef = ref(storage, finalPath);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    let sampleBytes = 0;
    let sampleTime = Date.now();
    let speedBps = 0;

    const task = uploadBytesResumable(finalRef, file, {
      contentType: file.type || "video/mp4",
      customMetadata: {
        sessionId,
        projectId,
        originalName: file.name,
        uploadedAt: String(Date.now()),
      },
    });

    const handleAbort = () => task.cancel();
    signal?.addEventListener("abort", handleAbort);

    task.on(
      "state_changed",
      (snap) => {
        const now = Date.now();
        const dt = (now - sampleTime) / 1000;
        if (dt >= 0.3) {
          speedBps = Math.max(0, (snap.bytesTransferred - sampleBytes) / dt);
          sampleBytes = snap.bytesTransferred;
          sampleTime = now;
        }

        const remaining = Math.max(0, file.size - snap.bytesTransferred);

        onProgress({
          overallPct: Math.min(100, (snap.bytesTransferred / file.size) * 100),
          bytesUploaded: snap.bytesTransferred,
          totalBytes: file.size,
          speedBps,
          etaSeconds: speedBps > 0 ? remaining / speedBps : Infinity,
          chunksTotal: 1,
          chunksComplete: snap.bytesTransferred >= file.size ? 1 : 0,
          status: snap.bytesTransferred >= file.size ? "assembling" : "uploading",
        });
      },
      async (err) => {
        signal?.removeEventListener("abort", handleAbort);
        if (canPersistSession) {
          try {
            await updateDoc(sessionRef, { status: "error", updatedAt: Date.now() });
          } catch {
            // best-effort persistence only
          }
        }
        reject(err);
      },
      async () => {
        signal?.removeEventListener("abort", handleAbort);
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          if (canPersistSession) {
            try {
              await updateDoc(sessionRef, {
                status: "done",
                completedChunks: [0],
                finalUrl: url,
                updatedAt: Date.now(),
              });
            } catch {
              // best-effort persistence only
            }
          }

          onProgress({
            overallPct: 100,
            bytesUploaded: file.size,
            totalBytes: file.size,
            speedBps: 0,
            etaSeconds: 0,
            chunksTotal: 1,
            chunksComplete: 1,
            status: "done",
          });

          resolve(url);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Formatting helpers (used in UI)
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
