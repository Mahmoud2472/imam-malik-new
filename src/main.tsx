import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/shared/ErrorBoundary.tsx';
import './index.css';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register Service Worker for offline capability with proactive update checking
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        // Trigger background check for service worker updates
        registration.update().catch(() => null);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Service Worker] New update available.');
              }
            });
          }
        });
      })
      .catch(err => {
        console.warn('ServiceWorker registration skipped:', err);
      });
  });
}

