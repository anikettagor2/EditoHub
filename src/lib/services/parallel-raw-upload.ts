import { functions, storage } from "@/lib/firebase/config";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { httpsCallable } from "firebase/functions";

const MB = 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 12 * MB;
const DEFAULT_MAX_CONCURRENT = 6;
const MAX_RETRIES_PER_CHUNK = 3;
const BASE_RETRY_DELAY_MS = 250;
const MAX_CONCURRENT_HARD_LIMIT = 12;

type NetworkInfoLike = {
  downlink?: number;
  effectiveType?: string;
  saveData?: boolean;
};

export interface ParallelRawUploadProgress {
  overallPct: number;
  bytesUploaded: number;
  totalBytes: number;
  chunksTotal: number;
  chunksComplete: number;
  speedBps: number;
  etaSeconds: number;
  currentConcurrency: number;
  maxConcurrency: number;
  chunkSizeBytes: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUploadTuning(fileSize: number): { chunkSize: number; maxConcurrent: number } {
  const nav = navigator as any;
  const connection = (nav?.connection || nav?.mozConnection || nav?.webkitConnection || {}) as NetworkInfoLike;

  const downlink = Number(connection.downlink || 0); // Mbps estimate
  const effectiveType = String(connection.effectiveType || "").toLowerCase();
  const saveData = connection.saveData === true;
  const hw = Math.max(2, Math.min(16, Number(navigator.hardwareConcurrency || 8)));

  let chunkSize = DEFAULT_CHUNK_SIZE;
  if (fileSize <= 250 * MB) chunkSize = 8 * MB;
  else if (fileSize <= 1024 * MB) chunkSize = 12 * MB;
  else if (fileSize <= 4096 * MB) chunkSize = 16 * MB;
  else chunkSize = 20 * MB;

  let maxConcurrent = DEFAULT_MAX_CONCURRENT;
  if (downlink >= 100) maxConcurrent = 10;
  else if (downlink >= 40) maxConcurrent = 8;
  else if (downlink >= 15) maxConcurrent = 6;
  else if (downlink >= 5) maxConcurrent = 4;
  else maxConcurrent = 3;

  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    maxConcurrent = 2;
    chunkSize = 6 * MB;
  }
  if (effectiveType === "3g") {
    maxConcurrent = Math.min(maxConcurrent, 3);
    chunkSize = Math.min(chunkSize, 8 * MB);
  }
  if (saveData) {
    maxConcurrent = Math.max(2, Math.min(maxConcurrent, 3));
    chunkSize = Math.min(chunkSize, 8 * MB);
  }

  // Keep the upload pool proportional to client CPU/network capabilities.
  maxConcurrent = Math.max(2, Math.min(maxConcurrent, hw - 1, MAX_CONCURRENT_HARD_LIMIT));

  return { chunkSize, maxConcurrent };
}

function splitFile(file: File, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let start = 0;
  while (start < file.size) {
    chunks.push(file.slice(start, Math.min(start + chunkSize, file.size)));
    start += chunkSize;
  }
  return chunks;
}

async function uploadChunkWithRetry(params: {
  blob: Blob;
  path: string;
  chunkIndex: number;
  onProgress: (chunkIndex: number, bytes: number) => void;
}): Promise<void> {
  const { blob, path, chunkIndex, onProgress } = params;

  for (let attempt = 0; attempt <= MAX_RETRIES_PER_CHUNK; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const partRef = ref(storage, path);
        const task = uploadBytesResumable(partRef, blob);

        task.on(
          "state_changed",
          (snapshot) => {
            onProgress(chunkIndex, snapshot.bytesTransferred);
          },
          (error) => reject(error),
          () => resolve()
        );
      });
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES_PER_CHUNK) {
        throw error;
      }

      // Exponential backoff with small jitter for transient network/storage failures.
      const jitter = Math.floor(Math.random() * 150);
      const backoff = BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + jitter;
      await delay(backoff);
    }
  }
}

async function withConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
  onState?: (state: { currentConcurrency: number; completed: number; total: number }) => void
): Promise<void> {
  if (tasks.length === 0) return;

  const maxLimit = Math.max(1, limit);
  let currentLimit = Math.max(2, Math.min(maxLimit, Math.ceil(maxLimit * 0.5)));

  let cursor = 0;
  let active = 0;
  let completed = 0;
  let rejected = false;

  await new Promise<void>((resolve, reject) => {
    const launch = () => {
      if (rejected) return;

      // Adaptive ramp-up: every 4 completed chunks, increase concurrency by 1 up to max.
      const targetLimit = Math.min(maxLimit, Math.max(currentLimit, 2 + Math.floor(completed / 4)));
      if (targetLimit !== currentLimit) {
        currentLimit = targetLimit;
      }

      onState?.({ currentConcurrency: currentLimit, completed, total: tasks.length });

      while (active < currentLimit && cursor < tasks.length) {
        const idx = cursor;
        cursor += 1;
        active += 1;

        tasks[idx]()
          .then(() => {
            active -= 1;
            completed += 1;

            if (completed === tasks.length) {
              onState?.({ currentConcurrency: currentLimit, completed, total: tasks.length });
              resolve();
              return;
            }

            launch();
          })
          .catch((error) => {
            rejected = true;
            reject(error);
          });
      }
    };

    launch();
  });
}

export async function uploadRawFileParallel(params: {
  projectId: string;
  ownerId: string;
  file: File;
  onProgress: (progress: ParallelRawUploadProgress) => void;
}): Promise<string> {
  const { projectId, ownerId, file, onProgress } = params;

  const tuning = getUploadTuning(file.size);

  const uploadId = `${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const chunks = splitFile(file, tuning.chunkSize);
  const totalChunks = chunks.length;

  const chunkBytes = new Map<number, number>();
  let sampleBytes = 0;
  let sampleTime = Date.now();
  let speedBps = 0;
  let currentConcurrency = Math.max(2, Math.min(tuning.maxConcurrent, Math.ceil(tuning.maxConcurrent * 0.5)));

  function emitProgress() {
    const bytesUploaded = Array.from(chunkBytes.values()).reduce((sum, value) => sum + value, 0);
    const chunksComplete = Array.from(chunkBytes.values()).filter((value, index) => value >= chunks[index].size).length;

    const now = Date.now();
    const dt = (now - sampleTime) / 1000;
    if (dt >= 0.3) {
      speedBps = Math.max(0, (bytesUploaded - sampleBytes) / dt);
      sampleBytes = bytesUploaded;
      sampleTime = now;
    }

    const remaining = Math.max(0, file.size - bytesUploaded);

    onProgress({
      overallPct: Math.min(100, (bytesUploaded / file.size) * 100),
      bytesUploaded,
      totalBytes: file.size,
      chunksTotal: totalChunks,
      chunksComplete,
      speedBps,
      etaSeconds: speedBps > 0 ? remaining / speedBps : Infinity,
      currentConcurrency,
      maxConcurrency: tuning.maxConcurrent,
      chunkSizeBytes: tuning.chunkSize,
    });
  }

  emitProgress();

  const tasks = chunks.map((chunk, index) => async () => {
    const path = `raw_footage/${ownerId}/multipart/${uploadId}/parts/part_${String(index).padStart(5, "0")}`;

    await uploadChunkWithRetry({
      blob: chunk,
      path,
      chunkIndex: index,
      onProgress: (chunkIndex, bytes) => {
        chunkBytes.set(chunkIndex, bytes);
        emitProgress();
      },
    });

    chunkBytes.set(index, chunk.size);
    emitProgress();
  });

  await withConcurrency(tasks, tuning.maxConcurrent, (state) => {
    currentConcurrency = state.currentConcurrency;
    emitProgress();
  });

  const composeRawUpload = httpsCallable(functions, "composeRawUpload");
  const composeResult = await composeRawUpload({
    projectId,
    ownerId,
    uploadId,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    partsCount: totalChunks,
  });

  const destinationPath = String((composeResult.data as any)?.destinationPath || "");
  if (!destinationPath) {
    throw new Error("Upload compose failed: destination path missing");
  }

  const finalRef = ref(storage, destinationPath);
  return await getDownloadURL(finalRef);
}
