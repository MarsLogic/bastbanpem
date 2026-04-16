// [UIUX-005] PDF Blob Persistence via IndexedDB
// Blobs can't be JSON-serialized, so we store them separately in IndexedDB
// This allows PDFs to persist across page reloads and browser restarts

const DB_NAME = 'BASTAutomator_PDFs';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

let db: IDBDatabase | null = null;

export const initPdfDb = async (): Promise<IDBDatabase> => {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        // Store: key = contractId, value = { blob: Blob, contractPdfPath: string, timestamp: number }
        database.createObjectStore(STORE_NAME, { keyPath: 'contractId' });
      }
    };
  });
};

export const savePdfBlob = async (contractId: string, blob: Blob, contractPdfPath: string): Promise<void> => {
  const database = await initPdfDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      contractId,
      blob,
      contractPdfPath,
      timestamp: Date.now()
    };

    const request = store.put(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getPdfBlob = async (contractId: string): Promise<Blob | null> => {
  const database = await initPdfDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(contractId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const record = request.result;
      resolve(record?.blob || null);
    };
  });
};

export const deletePdfBlob = async (contractId: string): Promise<void> => {
  const database = await initPdfDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(contractId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const clearAllPdfs = async (): Promise<void> => {
  const database = await initPdfDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
