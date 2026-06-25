// Safely shim localStorage for environments where third-party iframe cookie/storage restrictions are active
try {
  const testKey = '__storage_test_main__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch (e) {
  console.warn('[Storage Shim] localStorage is blocked or restricted. Activating in-memory storage fallback.');
  const memoryStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string): string | null => {
      return memoryStorage[key] !== undefined ? memoryStorage[key] : null;
    },
    setItem: (key: string, value: string): void => {
      memoryStorage[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete memoryStorage[key];
    },
    clear: (): void => {
      for (const key in memoryStorage) {
        delete memoryStorage[key];
      }
    },
    key: (index: number): string | null => {
      return Object.keys(memoryStorage)[index] || null;
    },
    get length(): number {
      return Object.keys(memoryStorage).length;
    }
  };

  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
      enumerable: true,
      writable: true
    });
  } catch (err) {
    try {
      (window as any).localStorage = mockLocalStorage;
    } catch (err2) {
      // Ignored
    }
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
