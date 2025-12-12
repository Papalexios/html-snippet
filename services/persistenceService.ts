
const DB_NAME = 'QuizForgeDB';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        reject(new Error("IndexedDB not supported"));
        return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'postId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveDraft = async (postId: number, data: any) => {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ postId, ...data, updatedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
      console.warn("Failed to save draft", e);
  }
};

export const getDraft = async (postId: number) => {
  try {
    const db = await openDB();
    return new Promise<any>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(postId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
  } catch (e) {
      console.warn("Failed to get draft", e);
      return null;
  }
};

export const deleteDraft = async (postId: number) => {
  try {
      const db = await openDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(postId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
  } catch (e) {
      console.warn("Failed to delete draft", e);
  }
};
