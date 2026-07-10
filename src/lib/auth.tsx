import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { safeStorage } from './safeStorage';
import { addDebugLog } from './debug';
import { db } from './firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export interface UserRoleData {
  role: 'admin' | 'teacher' | 'student' | 'applicant';
  displayName: string;
  email: string;
  studentId?: string;
  teacherId?: string;
  photoUrl?: string;
  hasPaidApplication?: boolean;
  admissionStatus?: 'pending' | 'approved' | 'rejected';
  targetClass?: string;
}

export interface CompactSupabaseUser {
  id: string;
  uid: string; // Backward compatibility alias for Firebase's user.uid
  email?: string;
  displayName?: string;
}

interface AuthContextType {
  user: CompactSupabaseUser | null;
  userData: UserRoleData | null;
  loading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isApplicant: boolean;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<void>;
  signInSession: (userId: string, email: string, displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CompactSupabaseUser | null>(null);
  const [userData, setUserData] = useState<UserRoleData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string) => {
    addDebugLog('Auth Service', `Fetching profile metadata for user ID: "${userId}" (${email})...`, 'info');
    const cacheKey = `imsc_user_data_${userId}`;
    const cached = safeStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        addDebugLog('Auth Service', `Retrieved local cache backup. Predicted role: ${parsed.role}`, 'info');
        setUserData(parsed);
      } catch (e) {
        console.warn("Could not parse cached user data", e);
      }
    }

    try {
      // Query both Supabase profile and Firestore user record in parallel to ensure up-to-date values
      const [supabaseRes, firestoreSnap] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
          .catch(err => {
            console.warn("Supabase profile fetch error:", err);
            return { data: null, error: err };
          }),
        getDoc(doc(db, "users", userId)).catch(err => {
          console.warn("Firestore user record fetch error:", err);
          return null;
        })
      ]);

      const profile = supabaseRes && 'data' in supabaseRes ? supabaseRes.data : null;
      const firestoreUser = firestoreSnap && firestoreSnap.exists() ? firestoreSnap.data() : null;

      if (profile || firestoreUser) {
        const dataToSet: UserRoleData = {
          role: (firestoreUser?.role || profile?.role || 'applicant') as any,
          displayName: profile?.displayName || profile?.display_name || firestoreUser?.displayName || email.split('@')[0],
          email: profile?.email || firestoreUser?.email || email,
          studentId: firestoreUser?.studentId || profile?.studentId || profile?.student_id,
          teacherId: firestoreUser?.teacherId || profile?.teacherId || profile?.teacher_id,
          photoUrl: profile?.photoUrl || profile?.photo_url || firestoreUser?.photoUrl,
          hasPaidApplication: firestoreUser?.hasPaidApplication !== undefined ? firestoreUser.hasPaidApplication : (profile?.hasPaidApplication || profile?.has_paid_application),
          admissionStatus: (firestoreUser?.admissionStatus || profile?.admissionStatus || profile?.admission_status || 'pending') as any,
          targetClass: firestoreUser?.targetClass || profile?.targetClass || profile?.target_class
        };
        addDebugLog('Auth Service', `Database profile resolved. Verified Role: "${dataToSet.role}" | Status: "${dataToSet.admissionStatus}" | Name: "${dataToSet.displayName}"`, 'success');
        setUserData(dataToSet);
        safeStorage.setItem(cacheKey, JSON.stringify(dataToSet));
      } else {
        // Auto-provision if profile is missing in the database
        const emailLower = email.toLowerCase();
        let role: 'admin' | 'teacher' | 'student' | 'applicant' = 'applicant';
        
        if (emailLower.includes('admin')) {
          role = 'admin';
        } else if (emailLower.includes('teacher')) {
          role = 'teacher';
        } else if (emailLower.includes('student')) {
          role = 'student';
        }

        addDebugLog('Auth Service', `No database profile record found for user. Auto-provisioning default role: "${role}"`, 'warn');

        const defaultProfile: UserRoleData = {
          role,
          displayName: email.split('@')[0] || 'User',
          email,
          admissionStatus: 'pending'
        };

        // Suppress errors during offline mock mode
        await supabase.from('profiles').insert({
          id: userId,
          email,
          role,
          displayName: defaultProfile.displayName,
          admission_status: 'pending'
        });

        setUserData(defaultProfile);
        safeStorage.setItem(cacheKey, JSON.stringify(defaultProfile));
      }
    } catch (err) {
      addDebugLog('Auth Service', `Database profile check failed. Falling back to local cache or defaults. Error: ${err instanceof Error ? err.message : String(err)}`, 'warn');
      if (!safeStorage.getItem(cacheKey)) {
        const emailLower = email.toLowerCase();
        let predictedRole: 'admin' | 'teacher' | 'student' | 'applicant' = 'applicant';
        if (emailLower.includes('admin')) {
          predictedRole = 'admin';
        } else if (emailLower.includes('teacher')) {
          predictedRole = 'teacher';
        } else if (emailLower.includes('student')) {
          predictedRole = 'student';
        }

        const fallbackUser: UserRoleData = {
          role: predictedRole,
          displayName: email.split('@')[0] || 'Offline User',
          email
        };
        setUserData(fallbackUser);
      }
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchProfile(user.id, user.email || '');
    }
  };

  useEffect(() => {
    // 1. Initial Session Load
    const loadSession = async () => {
      addDebugLog('Auth Service', 'Checking active authentication session...', 'info');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session?.user) {
          const authUser = session.user;
          const compatUser: CompactSupabaseUser = {
            id: authUser.id,
            uid: authUser.id, // Backward compatibility with firebase user.uid
            email: authUser.email,
            displayName: authUser.user_metadata?.displayName || authUser.email?.split('@')[0]
          };
          addDebugLog('Auth Service', `Active session verified for user: "${compatUser.email}"`, 'success');
          setUser(compatUser);
          safeStorage.setItem('imsc_active_user_id', authUser.id);
          fetchProfile(authUser.id, authUser.email || '');
        } else {
          // Fallback to local session check to bypass email verification / auth errors
          const localUserId = safeStorage.getItem('imsc_active_user_id');
          if (localUserId) {
            const cacheKey = `imsc_user_data_${localUserId}`;
            const cachedProfileRaw = safeStorage.getItem(cacheKey);
            let cachedEmail = 'user@school.com';
            let cachedName = 'Demo User';
            
            if (cachedProfileRaw) {
              try {
                const cached = JSON.parse(cachedProfileRaw);
                cachedEmail = cached.email || cachedEmail;
                cachedName = cached.displayName || cached.display_name || cachedName;
              } catch (e) {}
            }
            
            const compatUser: CompactSupabaseUser = {
              id: localUserId,
              uid: localUserId,
              email: cachedEmail,
              displayName: cachedName
            };
            addDebugLog('Auth Service', `Loaded local fallback session for: "${cachedEmail}"`, 'success');
            setUser(compatUser);
            fetchProfile(localUserId, cachedEmail);
          } else {
            addDebugLog('Auth Service', 'No active session found. Directing to sign-in page.', 'info');
            setUser(null);
            setUserData(null);
          }
        }
      } catch (err) {
        addDebugLog('Auth Service', 'Failed to retrieve auth session, checking local storage...', 'warn');
        const localUserId = safeStorage.getItem('imsc_active_user_id');
        if (localUserId) {
          const cacheKey = `imsc_user_data_${localUserId}`;
          const cachedProfileRaw = safeStorage.getItem(cacheKey);
          let cachedEmail = 'user@school.com';
          let cachedName = 'Demo User';
          
          if (cachedProfileRaw) {
            try {
              const cached = JSON.parse(cachedProfileRaw);
              cachedEmail = cached.email || cachedEmail;
              cachedName = cached.displayName || cached.display_name || cachedName;
            } catch (e) {}
          }
          
          const compatUser: CompactSupabaseUser = {
            id: localUserId,
            uid: localUserId,
            email: cachedEmail,
            displayName: cachedName
          };
          setUser(compatUser);
          fetchProfile(localUserId, cachedEmail);
        }
      } finally {
        setLoading(false);
      }
    };

    loadSession();

    // 2. Realtime Auth State Listeners
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addDebugLog('Auth Service', `Authentication state event triggered: "${event}"`, 'info');
      if (session?.user) {
        const authUser = session.user;
        const compatUser: CompactSupabaseUser = {
          id: authUser.id,
          uid: authUser.id,
          email: authUser.email,
          displayName: authUser.user_metadata?.displayName || authUser.email?.split('@')[0]
        };
        addDebugLog('Auth Service', `Session loaded for user: "${compatUser.email}" (Role: ${session.user.user_metadata?.role || 'applicant'})`, 'success');
        setUser(compatUser);
        safeStorage.setItem('imsc_active_user_id', authUser.id);
        fetchProfile(authUser.id, authUser.email || '');
      } else {
        // Fallback to local session check so a reload doesn't sign out local/mock users
        const localUserId = safeStorage.getItem('imsc_active_user_id');
        if (localUserId) {
          const cacheKey = `imsc_user_data_${localUserId}`;
          const cachedProfileRaw = safeStorage.getItem(cacheKey);
          let cachedEmail = 'user@school.com';
          let cachedName = 'Demo User';
          
          if (cachedProfileRaw) {
            try {
              const cached = JSON.parse(cachedProfileRaw);
              cachedEmail = cached.email || cachedEmail;
              cachedName = cached.displayName || cached.display_name || cachedName;
            } catch (e) {}
          }
          
          const compatUser: CompactSupabaseUser = {
            id: localUserId,
            uid: localUserId,
            email: cachedEmail,
            displayName: cachedName
          };
          setUser(compatUser);
          fetchProfile(localUserId, cachedEmail);
        } else {
          addDebugLog('Auth Service', 'No active user. Authenticated state cleared.', 'info');
          setUser(null);
          setUserData(null);
        }
      }
      setLoading(false);
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Realtime database user profile synchronization
  useEffect(() => {
    if (!user?.uid) return;

    // 1. Firestore Users realtime snapshot listener
    const unsubFirestoreUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const firestoreUser = snap.data();
        setUserData(prev => {
          const updated: UserRoleData = {
            role: (firestoreUser.role || prev?.role || 'applicant') as any,
            displayName: firestoreUser.displayName || prev?.displayName || user.displayName || user.email?.split('@')[0] || 'User',
            email: firestoreUser.email || prev?.email || user.email || '',
            studentId: firestoreUser.studentId || prev?.studentId,
            teacherId: firestoreUser.teacherId || prev?.teacherId,
            photoUrl: firestoreUser.photoUrl || prev?.photoUrl,
            hasPaidApplication: firestoreUser.hasPaidApplication !== undefined ? firestoreUser.hasPaidApplication : prev?.hasPaidApplication,
            admissionStatus: (firestoreUser.admissionStatus || prev?.admissionStatus || 'pending') as any,
            targetClass: firestoreUser.targetClass || prev?.targetClass
          };
          const cacheKey = `imsc_user_data_${user.uid}`;
          safeStorage.setItem(cacheKey, JSON.stringify(updated));
          return updated;
        });
      }
    }, (err) => {
      console.warn("Realtime Firestore user listener subscription error:", err);
    });

    // 2. Supabase Profiles table realtime changes listener
    let supabaseChannel: any = null;
    if (isSupabaseConfigured) {
      try {
        supabaseChannel = supabase
          .channel(`user-profile-realtime-${user.uid}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.uid}` },
            (payload: any) => {
              const profile = payload.new;
              if (profile) {
                setUserData(prev => {
                  const updated: UserRoleData = {
                    role: (profile.role || prev?.role || 'applicant') as any,
                    displayName: profile.displayName || profile.display_name || prev?.displayName || user.displayName || 'User',
                    email: profile.email || prev?.email || user.email || '',
                    studentId: profile.studentId || profile.student_id || prev?.studentId,
                    teacherId: profile.teacherId || profile.teacher_id || prev?.teacherId,
                    photoUrl: profile.photoUrl || profile.photo_url || prev?.photoUrl,
                    hasPaidApplication: profile.hasPaidApplication !== undefined ? profile.hasPaidApplication : prev?.hasPaidApplication,
                    admissionStatus: (profile.admissionStatus || profile.admission_status || prev?.admissionStatus || 'pending') as any,
                    targetClass: profile.targetClass || profile.target_class || prev?.targetClass
                  };
                  const cacheKey = `imsc_user_data_${user.uid}`;
                  safeStorage.setItem(cacheKey, JSON.stringify(updated));
                  return updated;
                });
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("Realtime Supabase profile channel error:", err);
      }
    }

    return () => {
      unsubFirestoreUser();
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel).catch((err: any) => {
          console.warn("Error removing user profile supabase channel:", err);
        });
      }
    };
  }, [user]);

  const signOut = async () => {
    addDebugLog('Auth Service', 'Signing out user and clearing local sessions...', 'info');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase auth signOut error:", err);
    }
    // Clear session cache
    safeStorage.removeItem('imsc_active_user_id');
    safeStorage.removeItem('imsc_active_user_email');
    safeStorage.removeItem('imsc_active_user_display_name');
    setUser(null);
    setUserData(null);
  };

  const signInSession = async (userId: string, email: string, displayName: string) => {
    addDebugLog('Auth Service', `Explicitly logging in session for ${email} (${userId})`, 'success');
    safeStorage.setItem('imsc_active_user_id', userId);
    const compatUser: CompactSupabaseUser = {
      id: userId,
      uid: userId,
      email,
      displayName
    };
    setUser(compatUser);
    await fetchProfile(userId, email);
  };

  const value = {
    user,
    userData,
    loading,
    isAdmin: userData?.role === 'admin',
    isTeacher: userData?.role === 'teacher',
    isStudent: userData?.role === 'student',
    isApplicant: userData?.role === 'applicant',
    refreshUserData,
    signOut,
    signInSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
