const DB_NAME = "piano-examiner";
const DB_VERSION = 1;
const STORE = "practice-recordings";

export type CachedRecording = {
  pieceId: string;
  blob: Blob;
  savedPerformanceId: string | null;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open recording cache."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "pieceId" });
      }
    };
  });
}

export async function savePracticeRecording(
  pieceId: string,
  blob: Blob,
  savedPerformanceId: string | null = null,
): Promise<void> {
  const existing = await loadPracticeRecording(pieceId);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put({
      pieceId,
      blob,
      savedPerformanceId: savedPerformanceId ?? existing?.savedPerformanceId ?? null,
      savedAt: Date.now(),
    } satisfies CachedRecording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save recording."));
  });
  db.close();
}

export async function updateSavedPerformanceId(
  pieceId: string,
  savedPerformanceId: string,
): Promise<void> {
  const existing = await loadPracticeRecording(pieceId);
  if (!existing) return;
  await savePracticeRecording(pieceId, existing.blob, savedPerformanceId);
}

export async function loadPracticeRecording(pieceId: string): Promise<CachedRecording | null> {
  const db = await openDb();
  const row = await new Promise<CachedRecording | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(pieceId);
    request.onsuccess = () => resolve(request.result as CachedRecording | undefined);
    request.onerror = () => reject(request.error ?? new Error("Failed to load recording."));
  });
  db.close();
  return row ?? null;
}

export async function clearPracticeRecording(pieceId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(pieceId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to clear recording."));
  });
  db.close();
}
