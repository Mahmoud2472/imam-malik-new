const memoryStorage: Record<string, string> = {};

let isStorageAvailable = false;
try {
  const testKey = '__storage_test__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
  isStorageAvailable = true;
} catch (e) {
  isStorageAvailable = false;
}

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (isStorageAvailable) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        // Fallback to in-memory
      }
    }
    return memoryStorage[key] !== undefined ? memoryStorage[key] : null;
  },
  setItem: (key: string, value: string): void => {
    if (isStorageAvailable) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback to in-memory
      }
    }
    memoryStorage[key] = String(value);
  },
  removeItem: (key: string): void => {
    if (isStorageAvailable) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback to in-memory
      }
    }
    delete memoryStorage[key];
  },
  clear: (): void => {
    if (isStorageAvailable) {
      try {
        window.localStorage.clear();
        return;
      } catch (e) {
        // Fallback to in-memory
      }
    }
    for (const key in memoryStorage) {
      delete memoryStorage[key];
    }
  }
};
