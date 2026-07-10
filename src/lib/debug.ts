import { useState, useEffect } from 'react';
import { safeStorage } from './safeStorage';

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  data?: any;
  type: 'info' | 'warn' | 'error' | 'success';
}

// Global logger store
const MAX_LOGS = 150;
let globalLogs: LogEntry[] = [];
const listeners = new Set<() => void>();

export const addDebugLog = (
  source: string, 
  message: string, 
  type: 'info' | 'warn' | 'error' | 'success' = 'info', 
  data?: any
) => {
  const logEntry: LogEntry = {
    id: 'log-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    source,
    message,
    type,
    data
  };
  globalLogs = [logEntry, ...globalLogs].slice(0, MAX_LOGS);
  
  // Also log to browser console
  const styles = {
    info: 'color: #0284c7; font-weight: bold;',
    warn: 'color: #ea580c; font-weight: bold;',
    error: 'color: #dc2626; font-weight: bold;',
    success: 'color: #16a34a; font-weight: bold;'
  };
  console.log(`%c[${source}] %c${message}`, styles[type] || '', 'color: inherit;', data !== undefined ? data : '');

  listeners.forEach(listener => listener());
};

export function useAuthDebug() {
  const [logs, setLogs] = useState<LogEntry[]>(globalLogs);

  useEffect(() => {
    const handleUpdate = () => {
      setLogs([...globalLogs]);
    };
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const clearLogs = () => {
    globalLogs = [];
    setLogs([]);
    addDebugLog('Debug System', 'Logs cleared.', 'info');
  };

  const getSystemStatus = () => {
    const activeUserId = safeStorage.getItem('imsc_active_user_id') || 'None';
    const forceMock = safeStorage.getItem('imsc_force_mock_supabase') === 'true';
    const isCustomUrl = !!safeStorage.getItem('imsc_custom_supabase_url');
    
    return {
      activeUserId,
      forceMock,
      isCustomUrl,
      localStorageKeys: Object.keys(localStorage).filter(k => k.startsWith('imsc_'))
    };
  };

  return {
    logs,
    clearLogs,
    addLog: addDebugLog,
    getSystemStatus
  };
}
