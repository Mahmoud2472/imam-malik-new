import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { safeStorage } from './safeStorage';
import { supabase, isSupabaseConfigured } from './supabase';
import { addDebugLog } from './debug';

export const SAMPLE_STORAGE_KEYS = [
  'imsc_applicants',
  'imsc_successful_applicants',
  'imsc_parsed_upload',
  'imsc_cached_applicants',
  'imsc_draft_admission_guest',
  'imsc_supabase_mock_students',
  'imsc_supabase_mock_applicants',
  'imsc_supabase_mock_successful_applicants',
  'imsc_supabase_mock_applications',
  'imsc_supabase_mock_payments',
  'imsc_supabase_mock_results',
  'imsc_supabase_mock_announcements',
  'imsc_supabase_mock_notifications',
  'imsc_supabase_mock_email_logs',
  'imsc_user_data_mock-student-id',
  'imsc_user_data_mock-teacher-id',
  'imsc_user_data_mock-applicant-id',
  'imsc_user_data_IMSC/2026/001',
  'imsc_user_data_IMSC/2026/002',
  'imsc_active_student_name',
  'imsc_active_user_display_name',
];

export const CORE_COLLECTIONS_TO_WIPE = [
  'applicants',
  'successful_applicants',
  'applications',
  'payments',
  'students',
  'results',
  'announcements',
  'notifications',
  'email_logs'
];

/**
 * Wipes out all sample, trial, and mock data across Firestore, Supabase, and localStorage.
 */
export async function wipeAllSampleData(): Promise<{ success: boolean; deletedCount: number }> {
  let totalDeleted = 0;

  // 1. Wipe all local storage / mock storage keys
  SAMPLE_STORAGE_KEYS.forEach(key => {
    safeStorage.removeItem(key);
  });

  // 2. Wipe dynamic draft admission entries
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('imsc_draft_admission_') || 
        key.startsWith('imsc_user_data_mock-') || 
        key.startsWith('imsc_paid_uid_mock-')
      )) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {}

  // 3. Reset mock profiles to strictly keep only the official administrator
  const cleanAdminProfiles = [
    { id: 'admin-system-id', email: 'admin@school.com', role: 'admin', displayName: 'School Administrator' }
  ];
  safeStorage.setItem('imsc_supabase_mock_profiles', JSON.stringify(cleanAdminProfiles));

  // 4. Wipe Firestore collections
  for (const collName of CORE_COLLECTIONS_TO_WIPE) {
    try {
      const snap = await getDocs(collection(db, collName));
      if (!snap.empty) {
        for (const docObj of snap.docs) {
          try {
            await deleteDoc(doc(db, collName, docObj.id));
            totalDeleted++;
          } catch (delErr) {
            console.warn(`Could not delete doc ${docObj.id} from ${collName}:`, delErr);
          }
        }
      }
    } catch (collErr) {
      console.warn(`Error reading collection ${collName} for wipe:`, collErr);
    }
  }

  // 5. Wipe Supabase tables if configured
  if (isSupabaseConfigured) {
    for (const tableName of CORE_COLLECTIONS_TO_WIPE) {
      try {
        await supabase.from(tableName).delete().neq('id', '___none___');
      } catch (supErr) {
        console.warn(`Supabase wipe warning on table ${tableName}:`, supErr);
      }
    }
  }

  // 6. Notify active mock listeners to refresh state
  CORE_COLLECTIONS_TO_WIPE.forEach(table => {
    try {
      window.dispatchEvent(new CustomEvent('supabase-mock-change', { detail: { table } }));
    } catch (e) {}
  });

  addDebugLog('System Cleanup', `Complete wipeout executed: ${totalDeleted} cloud documents and all sample local storage purged.`, 'success');
  return { success: true, deletedCount: totalDeleted };
}

/**
 * Automatically cleans lingering sample data once on client boot for production readiness.
 */
export function autoWipeSampleDataOnStartup(): void {
  const WIPE_VERSION_KEY = 'imsc_sample_data_wiped_v3';
  if (safeStorage.getItem(WIPE_VERSION_KEY) === 'true') {
    return;
  }

  try {
    // Clear sample storage keys
    SAMPLE_STORAGE_KEYS.forEach(key => {
      safeStorage.removeItem(key);
    });

    // Reset mock profiles to remove any demo teachers or students
    const cleanAdminProfiles = [
      { id: 'admin-system-id', email: 'admin@school.com', role: 'admin', displayName: 'School Administrator' }
    ];
    safeStorage.setItem('imsc_supabase_mock_profiles', JSON.stringify(cleanAdminProfiles));

    // Clear active mock user if it was a demo student or teacher
    const activeUserId = safeStorage.getItem('imsc_active_user_id');
    if (activeUserId && activeUserId.startsWith('mock-')) {
      safeStorage.removeItem('imsc_active_user_id');
    }

    safeStorage.setItem(WIPE_VERSION_KEY, 'true');
    addDebugLog('System Startup', 'Initial sample data purge completed. App ready for fresh deployment.', 'info');
  } catch (err) {
    console.warn('Auto wipe error on startup:', err);
  }
}
