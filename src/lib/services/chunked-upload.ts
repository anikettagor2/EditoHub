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
  const chunks = splitFile(file, CHUNK_SIZE);
  const totalChunks = chunks.length;

  // ── Load or create Firestore session ──────────────────────────────────────
  const sessionRef = doc(db, "upload_sessions", sessionId);
  let canPersistSession = true;
  let session: PersistedSession = {
    sessionId,
    projectId,
    fileName: file.name,
    fileSize: file.size,
    totalChunks,
    completedChunks: [],
    chunkPaths: {},
    status: "uploading",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const existingSnap = await getDoc(sessionRef);
    if (
      existingSnap.exists() &&
      (existingSnap.data() as PersistedSession).status === "uploading"
    ) {
      session = existingSnap.data() as PersistedSession;
    } else {
      await setDoc(sessionRef, session);
    }
  } catch (err) {
    // If Firestore upload_sessions is blocked by rules, continue without
    // persistence so draft upload still works.
    canPersistSession = false;
    console.warn("upload_sessions persistence unavailable; continuing upload without resume state", err);
  }

  const done = new Set<number>(session.completedChunks);

  // ── Progress tracking ─────────────────────────────────────────────────────
  // bytes[i] = bytes uploaded so far for chunk i
  const chunkBytes = new Map<number, number>();
  done.forEach((i) => chunkBytes.set(i, chunks[i].size));

  let speedSampleTime = Date.now();
  let lastSampleBytes = [...chunkBytes.values()].reduce((a, b) => a + b, 0);
  let speedBps = 0;

  function emitProgress(currentStatus: ChunkedUploadProgress["status"] = "uploading") {
    const bytesUploaded = [...chunkBytes.values()].reduce((a, b) => a + b, 0);
    const overallPct = Math.min(100, (bytesUploaded / file.size) * 100);
    const now = Date.now();
    const dt = (now - speedSampleTime) / 1000;
    if (dt >= 0.3) {
      speedBps = Math.max(0, (bytesUploaded - lastSampleBytes) / dt);
      lastSampleBytes = bytesUploaded;
      speedSampleTime = now;
    }
    const remaining = file.size - bytesUploaded;
    onProgress({
      overallPct,
      bytesUploaded,
      totalBytes: file.size,
      speedBps,
      etaSeconds: speedBps > 0 ? remaining / speedBps : Infinity,
      chunksTotal: totalChunks,
      chunksComplete: done.size,
      status: currentStatus,
    });
  }

  // Emit initial progress (handles resume case where some chunks are done)
  emitProgress("uploading");

  // ── Upload pending chunks in parallel ─────────────────────────────────────
  const pending = Array.from({ length: totalChunks }, (_, i) => i).filter(
    (i) => !done.has(i)
  );

  const uploadFns = pending.map((chunkIdx) => async () => {
    const path = `projects/${projectId}/chunks/${sessionId}/chunk_${String(chunkIdx).padStart(5, "0")}`;
    const chunkPath = await uploadChunk(
      chunks[chunkIdx],
      path,
      (bytes) => {
        chunkBytes.set(chunkIdx, bytes);
        emitProgress("uploading");
      },
      signal
    );

    done.add(chunkIdx);
    session.completedChunks = [...done];
    session.chunkPaths[chunkIdx] = chunkPath;

    if (canPersistSession) {
      try {
        await updateDoc(sessionRef, {
          completedChunks: session.completedChunks,
          [`chunkPaths.${chunkIdx}`]: chunkPath,
          updatedAt: Date.now(),
        });
      } catch (err) {
        canPersistSession = false;
        console.warn("Failed to persist chunk state; continuing upload", err);
      }
    }
  });

  await withConcurrency(uploadFns, MAX_CONCURRENT);

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // ── All chunks done – now upload the assembled video ──────────────────────
  // The Cloud Function will compose the chunks (GCS Compose), but we also
  // upload the full file directly so the revision is immediately available
  // without waiting for the function to run.
  emitProgress("assembling");

  const finalPath = `projects/${projectId}/revisions/${sessionId}/${file.name}`;
  const finalRef = ref(storage, finalPath);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const task = uploadBytesResumable(finalRef, file, {
      contentType: file.type || "video/mp4",
      customMetadata: {
        sessionId,
        projectId,
        originalName: file.name,
        uploadedAt: String(Date.now()),
      },
    });

    // Track progress on the final upload too
    task.on(
      "state_changed",
      (snap) => {
        // Keep showing 99% until fully done to avoid confusion
        const pct = Math.min(
          99,
          80 + (snap.bytesTransferred / snap.totalBytes) * 19
        );
        onProgress({
          overallPct: pct,
          bytesUploaded: snap.bytesTransferred,
          totalBytes: file.size,
          speedBps,
          etaSeconds: 0,
          chunksTotal: totalChunks,
          chunksComplete: totalChunks,
          status: "assembling",
        });
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          if (canPersistSession) {
            try {
              await updateDoc(sessionRef, {
                status: "done",
                finalUrl: url,
                updatedAt: Date.now(),
              });
            } catch (err) {
              console.warn("Failed to persist final upload session state", err);
            }
          }
          onProgress({
            overallPct: 100,
            bytesUploaded: file.size,
            totalBytes: file.size,
            speedBps: 0,
            etaSeconds: 0,
            chunksTotal: totalChunks,
            chunksComplete: totalChunks,
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
