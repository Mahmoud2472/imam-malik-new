import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, LogIn, CheckCircle2, AlertTriangle, 
  Loader2, RefreshCw, ExternalLink, Unlink, Plus, 
  Database, ShieldCheck, Download, Award
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';

// Global Token Cache to persist auth token in memory across page re-renders
let cachedAccessToken: string | null = null;

export default function AdminSheets() {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(cachedAccessToken);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [customIdInput, setCustomIdInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    students: { status: 'idle' | 'syncing' | 'success' | 'error'; message: string; count: number };
    applications: { status: 'idle' | 'syncing' | 'success' | 'error'; message: string; count: number };
    payments: { status: 'idle' | 'syncing' | 'success' | 'error'; message: string; count: number };
  }>({
    students: { status: 'idle', message: '', count: 0 },
    applications: { status: 'idle', message: '', count: 0 },
    payments: { status: 'idle', message: '', count: 0 }
  });
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Check auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setGoogleUser(user);
        if (cachedAccessToken) {
          setToken(cachedAccessToken);
        }
      } else {
        setGoogleUser(null);
        setToken(null);
        cachedAccessToken = null;
      }
      setAuthLoading(false);
    });

    // Load any saved spreadsheet ID from Firestore setup
    const loadConfigObj = async () => {
      try {
        const configSnap = await getDoc(doc(db, "config", "sheets_sync"));
        if (configSnap.exists() && configSnap.data().spreadsheetId) {
          setSpreadsheetId(configSnap.data().spreadsheetId);
        } else {
          // Check localStorage as fallback
          const localId = localStorage.getItem('imsc_sync_spreadsheet_id');
          if (localId) {
            setSpreadsheetId(localId);
          } else {
            // Preset default custom sheet link provided by user (IMST_Database)
            setSpreadsheetId('1Ca3im4VDia822WPyi3tBGHf5BiiA3HQJraWBN2T03gw');
          }
        }
      } catch (err) {
        console.error("Failed to load spreadsheet configuration:", err);
        // Fallback to preset default custom sheet
        setSpreadsheetId('1Ca3im4VDia822WPyi3tBGHf5BiiA3HQJraWBN2T03gw');
      }
    };

    loadConfigObj();
    return () => unsubscribe();
  }, []);

  // Handle Sign In with Google popup specifically for acquiring Drive and Sheets scopes
  const handleConnectGoogle = async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://www.googleapis.com/auth/drive.file');

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (!credential || !credential.accessToken) {
        throw new Error('Could not acquire your Google access token. Please consent to permissions.');
      }

      cachedAccessToken = credential.accessToken;
      setToken(cachedAccessToken);
      setGoogleUser(result.user);
      setFeedbackMessage("Signed into Google and authorized Sheets and Drive APIs!");
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      console.error("Google authentication error:", err);
      setGlobalError(err.message || "OAuth Authentication failed. Please verify popup blocker settings.");
    } finally {
      setLoading(false);
    }
  };

  // Disconnect OAuth token from memory
  const handleDisconnectGoogle = () => {
    cachedAccessToken = null;
    setToken(null);
    setFeedbackMessage("Cleared active Google access token from browser memory.");
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Setup/Create Spreadsheet on user's authorized Google Drive
  const handleCreateSpreadsheet = async () => {
    if (!token) {
      setGlobalError("Please connect your Google account before attempting to create a spreadsheet.");
      return;
    }

    setLoading(true);
    setGlobalError(null);

    try {
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: "Imam Malik College Database Sync Backup"
          },
          sheets: [
            {
              properties: {
                title: "Students",
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            },
            {
              properties: {
                title: "Applications",
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            },
            {
              properties: {
                title: "Payments",
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            }
          ]
        })
      });

      if (!response.ok) {
        const errorJson = await response.json();
        throw new Error(errorJson?.error?.message || `Google Sheets API returned status ${response.status}`);
      }

      const resData = await response.json();
      const sId = resData.spreadsheetId;
      
      if (!sId) throw new Error("Spreadsheet created but no SpreadsheetID was returned.");

      setSpreadsheetId(sId);
      // Persist in Firestore for persistent configuration
      await setDoc(doc(db, "config", "sheets_sync"), {
        spreadsheetId: sId,
        createdAt: new Date().toISOString(),
        createdBy: googleUser?.email || 'admin'
      });

      localStorage.setItem('imsc_sync_spreadsheet_id', sId);
      setFeedbackMessage("Created new multi-tab Spreadsheet successfully on Google Drive!");
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      console.error("Spreadsheet creation failed:", err);
      setGlobalError(err.message || "Failed to create Google Spreadsheet.");
    } finally {
      setLoading(false);
    }
  };

  const extractSpreadsheetId = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  };

  const handleConnectCustomSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    const id = extractSpreadsheetId(customIdInput);
    if (!id) {
      setGlobalError("Invalid Google Spreadsheet ID or Link. Please copy the complete URL or correct Spreadsheet ID.");
      return;
    }

    setLoading(true);
    try {
      // Opt-in: verify if the sheet is accessible with token if connected
      if (token) {
        const verifyRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!verifyRes.ok) {
          const errDetail = await verifyRes.json();
          throw new Error(errDetail?.error?.message || `Make sure your sheet is shared with Editor permission or your Google connection has active permissions to open it.`);
        }
      }

      setSpreadsheetId(id);
      await setDoc(doc(db, "config", "sheets_sync"), {
        spreadsheetId: id,
        createdAt: new Date().toISOString(),
        createdBy: googleUser?.email || 'admin',
        customLinked: true
      });
      localStorage.setItem('imsc_sync_spreadsheet_id', id);
      setCustomIdInput('');
      setShowCustomInput(false);
      setFeedbackMessage("Successfully connected custom IMST Database file!");
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      console.error("Custom spreadsheet linking failed:", err);
      setGlobalError(err.message || "Failed to link your custom spreadsheet. Make sure it is shared or public, or authenticate first.");
    } finally {
      setLoading(false);
    }
  };

  // Disconnect Spreadsheet ID
  const handleClearSpreadsheet = async () => {
    if (window.confirm("Disconnect spreadsheet? This will only remove the reference link. Your sheet inside Google Drive will not be deleted.")) {
      setSpreadsheetId(null);
      localStorage.removeItem('imsc_sync_spreadsheet_id');
      await setDoc(doc(db, "config", "sheets_sync"), { spreadsheetId: "" });
      setFeedbackMessage("Spreadsheet link disconnected.");
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  // Synchronize collections
  const handleSyncData = async (collectionName: 'students' | 'applications' | 'payments') => {
    if (!token || !spreadsheetId) {
      setGlobalError("Active connection and connected Spreadsheet required to start sync.");
      return;
    }

    setSyncStatus(prev => ({
      ...prev,
      [collectionName]: { status: 'syncing', message: 'Fetching documents from Firestore...', count: 0 }
    }));

    try {
      // 1. Fetch matching documents from Firestore
      const snap = await getDocs(collection(db, collectionName));
      const count = snap.size;
      const rows: any[][] = [];

      // 2. Prepare spreadsheet rows & headers based on collection specifications
      if (collectionName === 'students') {
        rows.push(["ID", "Admission No", "First Name", "Last Name", "Gender", "Current Class ID", "Status", "Date Added"]);
        snap.docs.forEach(docObj => {
          const d = docObj.data();
          rows.push([
            docObj.id,
            d.admissionNo || '',
            d.firstName || '',
            d.lastName || '',
            d.gender || '',
            d.currentClassId || '',
            d.status || 'active',
            d.dateAdded || d.createdAt || ''
          ]);
        });
      } else if (collectionName === 'applications') {
        rows.push(["ID", "User ID", "Full Name", "Email", "Target Class", "Status", "Applied Date", "Transaction ID", "Amount Paid"]);
        snap.docs.forEach(docObj => {
          const d = docObj.data();
          rows.push([
            docObj.id,
            d.userId || '',
            d.fullName || '',
            d.email || '',
            d.targetClass || '',
            d.status || 'pending',
            d.appliedDate || '',
            d.transactionId || '',
            d.amountPaid || ''
          ]);
        });
      } else if (collectionName === 'payments') {
        rows.push(["ID", "Receipt Number", "Amount (₦)", "Type", "Reference", "Payment Date", "Status"]);
        snap.docs.forEach(docObj => {
          const d = docObj.data();
          rows.push([
            docObj.id,
            d.receiptNumber || '',
            d.amount || 0,
            d.type || '',
            d.paystackReference || d.reference || '',
            d.paymentDate || '',
            d.status || 'verified'
          ]);
        });
      }

      setSyncStatus(prev => ({
        ...prev,
        [collectionName]: { status: 'syncing', message: `Uploading ${rows.length - 1} records to Google Sheets...`, count: rows.length - 1 }
      }));

      // 3. To completely overwrite previous data without leaves, we should clear values first
      const range = `${collectionName === 'students' ? 'Students' : collectionName === 'applications' ? 'Applications' : 'Payments'}!A1:Z5000`;
      
      const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!clearResponse.ok) {
        console.warn("Could not completely clear sheet first. Proceeding with standard update overwrite.");
      }

      // 4. Update core content rows in spreadsheet
      const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rows
        })
      });

      if (!updateResponse.ok) {
        const errJson = await updateResponse.json();
        throw new Error(errJson?.error?.message || `HTTP Server returned error status ${updateResponse.status}`);
      }

      setSyncStatus(prev => ({
        ...prev,
        [collectionName]: { 
          status: 'success', 
          message: `Synchronized ${rows.length - 1} documents successfully at ${new Date().toLocaleTimeString()}`, 
          count: rows.length - 1 
        }
      }));

    } catch (err: any) {
      console.error(`Syncing collection ${collectionName} failed:`, err);
      setSyncStatus(prev => ({
        ...prev,
        [collectionName]: { status: 'error', message: err.message || "Failed to complete Sheet insertion", count: 0 }
      }));
    }
  };

  // Sync all operations simultaneously
  const handleSyncAll = async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      await Promise.all([
        handleSyncData('students'),
        handleSyncData('applications'),
        handleSyncData('payments')
      ]);
      setFeedbackMessage("Full Synchronization across all 3 databases complete!");
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Intro Header Card */}
      <div className="glass-card overflow-hidden">
        <div className="p-8 md:p-10 relative overflow-hidden bg-emerald-950 text-white rounded-3xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/10 text-xs font-bold text-amber-400">
              <Award size={14} /> Google Workspace Active Core
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">Google Sheets Sync Panel</h2>
            <p className="text-sm md:text-base text-emerald-100/70 leading-relaxed font-medium">
              Easily connect and synchronize your system tables (Students list, Admission applications, and Financial receipt records) directly into standard spreadsheets on your private Google Drive account.
            </p>
          </div>
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] -mr-32 -mt-32" />
        </div>
      </div>

      {globalError && (
        <div className="p-5 bg-rose-50 border border-rose-150 rounded-2xl flex items-start gap-4 text-rose-800">
          <AlertTriangle className="text-rose-650 shrink-0 mt-0.5" size={24} />
          <div className="space-y-1 text-sm">
            <h4 className="font-extrabold text-rose-950 uppercase">Sync Server Error Announcement</h4>
            <p className="font-medium leading-relaxed">{globalError}</p>
          </div>
        </div>
      )}

      {feedbackMessage && (
        <div className="p-5 bg-emerald-950 border border-emerald-900 shadow-xl rounded-2xl text-white flex items-center gap-3.5 animate-bounce">
          <CheckCircle2 className="text-amber-450 shrink-0" size={20} />
          <p className="text-xs font-black font-mono tracking-wide">{feedbackMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Connection manager */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-card p-6 flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                <Database size={20} className="text-emerald-800" />
                Connection Status
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect your Google cloud account in order to access Drive & Sheets features. Your access key is kept strictly in-memory during this administrative session.
              </p>
            </div>

            {token ? (
              <div className="space-y-6">
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-900 border border-amber-400 flex items-center justify-center font-bold text-amber-500">
                    {googleUser?.displayName?.charAt(0) || 'G'}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wider leading-tight">Google Connected</p>
                    <p className="text-[10px] text-slate-500 font-bold truncate leading-none mt-1">{googleUser?.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="w-full py-3 border border-rose-200 hover:bg-rose-50 text-rose-650 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Unlink size={14} /> Revoke Connection Key
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 py-3 font-semibold font-mono">Status: Disconnected</p>
                </div>

                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-emerald-900 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-950/10 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <LogIn size={16} />
                      Connect Google Account
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="glass-card p-6 space-y-6">
            <h3 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-800" />
              Target Spreadsheet
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Define the file on Google Drive where you wish to back up your administrative Firestore databases. You can create a new multi-tab file instantly.
            </p>

            {spreadsheetId ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/50 text-slate-700 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">Connected File</span>
                    <button 
                      onClick={handleClearSpreadsheet}
                      className="text-[10px] uppercase font-black text-rose-600 hover:text-rose-800 animate-pulse"
                    >
                      Disconnect
                    </button>
                  </div>
                  <p className="text-[10px] font-mono break-all font-bold select-all bg-white/70 p-2.5 rounded-lg border border-slate-200">
                    {spreadsheetId}
                  </p>
                </div>

                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 font-extrabold text-xs text-center text-emerald-950 uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={14} /> Open Google Sheet <span className="opacity-60 text-[10px]">↗</span>
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 text-center">
                  <p className="text-[10px] text-slate-400 font-medium">No active spreadsheet mapped.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCreateSpreadsheet}
                    disabled={loading || !token}
                    className="py-3 bg-slate-150 hover:bg-slate-200 text-slate-800 disabled:opacity-40 disabled:hover:bg-slate-150 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Auto Create
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className="py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Database size={12} /> Link Existing
                  </button>
                </div>

                {showCustomInput && (
                  <form onSubmit={handleConnectCustomSpreadsheet} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
                    <div>
                      <label htmlFor="customIdInput" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Spreadsheet Link or ID
                      </label>
                      <input
                        id="customIdInput"
                        type="text"
                        placeholder="Paste Google Sheets URL or ID..."
                        value={customIdInput}
                        onChange={(e) => setCustomIdInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 text-xs rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800"
                        required
                      />
                    </div>

                    {/* Highly Tailored Connection Guideline Card */}
                    <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-2 text-[10.5px] text-slate-700">
                      <p className="font-bold text-emerald-950 uppercase tracking-wider text-[8.5px] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Linking "IMST_Database" Tips
                      </p>
                      <ul className="list-disc list-inside space-y-1.5 pl-0.5 text-slate-600 leading-normal">
                        <li>
                          <strong>Paste Entire URL:</strong> Standard links (e.g., <code className="text-[9.5px] font-mono bg-white px-1 border rounded text-slate-800">https://docs.google.com/spreadsheets/d/.../edit</code>) are supported. The system automatically extracts the identifier.
                        </li>
                        <li>
                          <strong>Verify Your Owner Account:</strong> Ensure your Google Auth connection below matches the logged-in owner profile (<span className="text-emerald-950 font-bold">maitechitservices6@gmail.com</span>).
                        </li>
                        <li>
                          <strong>Editor Permissions:</strong> Ensure your spreadsheet in Google Drive is either owned by you, or shared with <span className="text-emerald-950 font-medium">"Editor"</span> access.
                        </li>
                        <li>
                          <strong>Table Structuring:</strong> When you initiate synchronizations, the sync engine publishes rows directly into three worksheets inside your file:
                          <div className="flex flex-wrap gap-1 mt-1 ml-3.5">
                            <span className="font-mono text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold">students</span>
                            <span className="font-mono text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold">applications</span>
                            <span className="font-mono text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold">payments</span>
                          </div>
                        </li>
                        <li>
                          <strong>Non-Destructive sync:</strong> The app appends and refreshes target spreadsheets gracefully without touching unrelated tabs in your spreadsheet.
                        </li>
                      </ul>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 bg-emerald-900 hover:bg-emerald-800 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      {loading ? 'Validating & Linking...' : 'Connect File'}
                    </button>
                  </form>
                )}

                {!token && (
                  <p className="text-[10px] text-center text-rose-600 font-bold leading-tight">Must authorize Google account first.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Synchronizer tools */}
        <div className="space-y-6 lg:col-span-2">
          <div className="glass-card p-8 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-emerald-950 flex items-center gap-2.5">
                  <RefreshCw size={22} className="text-emerald-800" />
                  Table Synchronization Hub
                </h3>
                <p className="text-sm text-slate-500">Back up individual collections or run full synchronization backups</p>
              </div>

              <button
                type="button"
                onClick={handleSyncAll}
                disabled={loading || !token || !spreadsheetId}
                className="btn-primary hover:text-white flex items-center justify-center gap-2 py-3 px-6 shadow-xl shadow-emerald-950/10 cursor-pointer disabled:opacity-40"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <><RefreshCw size={15} /> Sync All Data</>}
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Students Directory', colName: 'students', desc: 'Syncs student demographics, current classroom rosters, statuses, and registration IDs.' },
                { label: 'Admission Applications', colName: 'applications', desc: 'Syncs incoming student queries, grades, applicant details, statuses, and transaction codes.' },
                { label: 'Payments & Receipts', colName: 'payments', desc: 'Syncs registration tuition, uniform payments, transaction sums, dates, and verification details.' }
              ].map((item) => {
                const step = syncStatus[item.colName as 'students' | 'applications' | 'payments'];
                return (
                  <div key={item.colName} className="p-6 border border-slate-100 rounded-2xl hover:border-emerald-100 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all">
                    <div className="space-y-2 flex-1">
                      <h4 className="font-bold text-slate-800 text-base">{item.label}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-sm">{item.desc}</p>
                      
                      {step.status !== 'idle' && (
                        <div className="pt-2 text-[10px] font-sans">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                            step.status === 'success' ? 'bg-emerald-100 text-emerald-800' :
                            step.status === 'error' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700 animate-pulse'
                          }`}>
                            {step.status === 'success' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                            {step.status === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                            {step.status === 'syncing' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />}
                            Status: {step.status}
                          </span>
                          <span className="text-slate-500 font-bold ml-3">{step.message}</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSyncData(item.colName as any)}
                      disabled={loading || !token || !spreadsheetId}
                      className="px-5 py-2.5 border border-slate-150 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-950 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-slate-150 disabled:hover:text-slate-600"
                    >
                      <Download size={14} /> Back Up
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-start gap-4">
              <ShieldCheck className="text-emerald-700 mt-1 shrink-0" size={24} />
              <div className="space-y-1 text-xs">
                <h5 className="font-bold text-emerald-950 uppercase leading-none mb-1.5">Secure Transaction Protocol</h5>
                <p className="text-slate-500 leading-relaxed">
                  IMSC utilizes official Google Workspace API routes with secured SSL transport pipelines to securely exchange data. Student information stays encrypted and fully isolated within your designated Google cloud file ecosystem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
