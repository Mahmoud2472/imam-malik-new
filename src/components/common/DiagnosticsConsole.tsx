import React, { useState, useEffect, useRef } from 'react';
import { useAuthDebug, addDebugLog } from '../../lib/debug';
import { useAuth } from '../../lib/auth';
import { safeStorage } from '../../lib/safeStorage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { Terminal, Shield, User, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Play, X, ChevronUp, ChevronDown } from 'lucide-react';

export function DiagnosticsConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'auth' | 'overrides'>('logs');
  const { logs, clearLogs, getSystemStatus } = useAuthDebug();
  const { user, userData, refreshUserData } = useAuth();
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    setStatus(getSystemStatus());
  }, [logs, user, userData]);

  useEffect(() => {
    if (isOpen && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen, activeTab]);

  const forceAuthenticate = async (role: 'admin' | 'applicant') => {
    addDebugLog('Debug System', `Executing Force Authenticate Override: "${role}"`, 'warn');
    
    // Switch to mock mode if not already
    safeStorage.setItem('imsc_force_mock_supabase', 'true');
    safeStorage.setItem('imsc_manual_mock_supabase', 'true');
    
    const mockId = `mock-${role}-${Math.floor(Math.random() * 100000)}`;
    const email = `${role}@school.com`;
    const displayName = role === 'admin' ? 'School Administrator' : 'Guest Applicant';
    
    const mockProfile = {
      id: mockId,
      email,
      role,
      displayName,
      createdAt: new Date().toISOString()
    };
    
    // Save to mock profiles store
    const currentMockProfiles = JSON.parse(safeStorage.getItem('imsc_supabase_mock_profiles') || '[]');
    currentMockProfiles.push(mockProfile);
    safeStorage.setItem('imsc_supabase_mock_profiles', JSON.stringify(currentMockProfiles));
    
    // Set active user
    safeStorage.setItem('imsc_active_user_id', mockId);
    safeStorage.setItem(`imsc_user_data_${mockId}`, JSON.stringify(mockProfile));
    
    addDebugLog('Debug System', `Force authentication success. Active User ID: ${mockId}`, 'success');
    window.location.reload();
  };

  const bypassPayment = () => {
    const activeId = user?.id || 'anon';
    addDebugLog('Debug System', `Bypassing Payment requirement for User ID: "${activeId}"`, 'warn');
    safeStorage.setItem(`imsc_paid_uid_${activeId}`, 'true');
    addDebugLog('Debug System', `Bypassed successfully! Step 3 unlocked.`, 'success');
    window.location.reload();
  };

  const toggleMockMode = () => {
    const current = safeStorage.getItem('imsc_force_mock_supabase') === 'true';
    if (current) {
      safeStorage.removeItem('imsc_force_mock_supabase');
      safeStorage.removeItem('imsc_manual_mock_supabase');
      addDebugLog('Debug System', `Switched Database to LIVE Mode. Reconnecting...`, 'info');
    } else {
      safeStorage.setItem('imsc_force_mock_supabase', 'true');
      safeStorage.setItem('imsc_manual_mock_supabase', 'true');
      addDebugLog('Debug System', `Switched Database to OFFLINE Mock Sandbox.`, 'warn');
    }
    window.location.reload();
  };

  const resetAllAppStorage = () => {
    addDebugLog('Debug System', 'Resetting application cache & sessions...', 'warn');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('imsc_')) {
        localStorage.removeItem(key);
      }
    });
    addDebugLog('Debug System', 'App state fully reset. Reloading.', 'success');
    window.location.reload();
  };

  return (
    <div id="diagnostics-dev-console" className="fixed bottom-0 right-0 left-0 z-50 font-sans">
      {/* Tab Trigger */}
      <div className="flex justify-end px-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] cursor-pointer ${
            isOpen 
              ? 'bg-slate-900 text-white hover:bg-slate-800' 
              : 'bg-emerald-800 text-white hover:bg-emerald-900 border border-b-0 border-emerald-700/50'
          }`}
        >
          <Terminal size={14} className={isOpen ? 'animate-pulse text-emerald-400' : ''} />
          <span>Dev Diagnostics Hub</span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Expanded Console Drawer */}
      {isOpen && (
        <div className="bg-slate-950 border-t border-slate-800 text-slate-100 shadow-2xl h-80 flex flex-col">
          {/* Header */}
          <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">System Trace Center</span>
              <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10.5px]">
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    activeTab === 'logs' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Trace Logs ({logs.length})
                </button>
                <button
                  onClick={() => setActiveTab('auth')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    activeTab === 'auth' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Auth Session
                </button>
                <button
                  onClick={() => setActiveTab('overrides')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    activeTab === 'overrides' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Dev Overrides
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${status?.forceMock ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {status?.forceMock ? 'Offline Sandbox Mode' : 'Supabase Connected'}
              </span>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all ml-2"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Tab Body */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
            {activeTab === 'logs' && (
              <div className="space-y-1.5">
                {logs.length === 0 ? (
                  <div className="text-slate-500 text-center py-12 italic">
                    No tracing logs generated yet. Perform some actions to see traces.
                  </div>
                ) : (
                  logs.map((log) => {
                    const typeColors = {
                      info: 'text-sky-400',
                      success: 'text-emerald-400',
                      warn: 'text-amber-500',
                      error: 'text-rose-500'
                    };
                    return (
                      <div key={log.id} className="flex items-start gap-2 py-0.5 border-b border-slate-900 hover:bg-slate-900/40 px-2 rounded">
                        <span className="text-[10px] text-slate-500 shrink-0">{log.timestamp}</span>
                        <span className="text-slate-400 font-bold shrink-0">[{log.source}]</span>
                        <span className={`${typeColors[log.type]} flex-1`}>{log.message}</span>
                        {log.data && (
                          <span className="text-[10px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded italic shrink-0 max-w-xs truncate">
                            {typeof log.data === 'object' ? JSON.stringify(log.data) : String(log.data)}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={consoleEndRef} />
              </div>
            )}

            {activeTab === 'auth' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono h-full">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
                  <h4 className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <User size={12} /> Live Firebase/Supabase User
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-400">Authenticated:</span>
                      <span className={user ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {user ? 'YES' : 'NO'}
                      </span>
                    </div>
                    {user && (
                      <>
                        <div className="flex justify-between border-b border-slate-800/40 pb-1">
                          <span className="text-slate-400">User ID:</span>
                          <span className="text-slate-200 select-all font-mono">{user.id}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/40 pb-1">
                          <span className="text-slate-400">Email:</span>
                          <span className="text-slate-200">{user.email}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
                  <h4 className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <Shield size={12} /> App-Specific Meta profile
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-400">Role Status:</span>
                      <span className="text-emerald-400 font-bold uppercase">{userData?.role || 'None'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-400">Display Name:</span>
                      <span className="text-slate-200">{userData?.displayName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-400">Admission Status:</span>
                      <span className="text-amber-400 uppercase font-semibold">{userData?.admissionStatus || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-400">Custom Credentials:</span>
                      <span className={status?.isCustomUrl ? 'text-emerald-400' : 'text-slate-500'}>
                        {status?.isCustomUrl ? 'Custom DB' : 'System Default'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'overrides' && (
              <div className="space-y-4">
                <p className="text-[10px] text-slate-400 leading-relaxed max-w-2xl">
                  ⚠️ <strong>Quick Override Panel:</strong> Use these buttons during development to instantly trigger different authentication levels, mock payments, and bypass external network dependencies:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => forceAuthenticate('applicant')}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-[10px] font-bold text-slate-200 hover:text-white transition-all cursor-pointer"
                  >
                    <User size={12} className="text-sky-400" />
                    <span>Force Guest User</span>
                  </button>

                  <button
                    onClick={() => forceAuthenticate('admin')}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-[10px] font-bold text-slate-200 hover:text-white transition-all cursor-pointer"
                  >
                    <Shield size={12} className="text-emerald-400" />
                    <span>Force Admin User</span>
                  </button>

                  <button
                    onClick={bypassPayment}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-[10px] font-bold text-slate-200 hover:text-white transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={12} className="text-amber-500" />
                    <span>Bypass Payment (Step 3)</span>
                  </button>

                  <button
                    onClick={toggleMockMode}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-[10px] font-bold text-slate-200 hover:text-white transition-all cursor-pointer"
                  >
                    <RefreshCw size={12} className="text-violet-400" />
                    <span>{status?.forceMock ? 'Use Live Supabase' : 'Use Mock Sandbox'}</span>
                  </button>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-900 justify-end">
                  <button
                    onClick={clearLogs}
                    className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Clear Logs</span>
                  </button>
                  <button
                    onClick={resetAllAppStorage}
                    className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 px-2.5 py-1.5 rounded-md hover:bg-rose-950/40 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Reset All Diagnostics</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
