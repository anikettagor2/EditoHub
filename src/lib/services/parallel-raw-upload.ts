import { functions, storage } from "@/lib/firebase/config";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { httpsCallable } from "firebase/functions";

const RAW_CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
const RAW_MAX_CONCURRENT = 6;
const MAX_RETRIES_PER_CHUNK = 2;

export interface ParallelRawUploadProgress {
  overallPct: number;
  bytesUploaded: number;
  totalBytes: number;
  chunksTotal: number;
  chunksComplete: number;
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
    }
  }
}

async function withConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number
): Promise<void> {
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const current = cursor;
      cursor += 1;
      await tasks[current]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );
}

export async function uploadRawFileParallel(params: {
  projectId: string;
  ownerId: string;
  file: File;
  onProgress: (progress: ParallelRawUploadProgress) => void;
}): Promise<string> {
  const { projectId, ownerId, file, onProgress } = params;

  const uploadId = `${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const chunks = splitFile(file, RAW_CHUNK_SIZE);
  const totalChunks = chunks.length;

  const chunkBytes = new Map<number, number>();

  function emitProgress() {
    const bytesUploaded = Array.from(chunkBytes.values()).reduce((sum, value) => sum + value, 0);
    const chunksComplete = Array.from(chunkBytes.values()).filter((value, index) => value >= chunks[index].size).length;

    onProgress({
      overallPct: Math.min(100, (bytesUploaded / file.size) * 100),
      bytesUploaded,
      totalBytes: file.size,
      chunksTotal: totalChunks,
      chunksComplete,
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

  await withConcurrency(tasks, RAW_MAX_CONCURRENT);

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
