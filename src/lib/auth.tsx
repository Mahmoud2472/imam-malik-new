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
  passportUrl?: string;
  passportPhoto?: string;
  phone?: string;
  phoneNumber?: string;
  gender?: string;
  dob?: string;
  dateOfBirth?: string;
  stateOfOrigin?: string;
  lga?: string;
  address?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
  hasPaidApplication?: boolean;
  admissionStatus?: 'pending' | 'approved' | 'rejected';
  targetClass?: string;
  class?: string;
  examNumber?: string;
  entranceScore?: number;
  schoolName?: string;
  previousSchool?: string;
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
  updateUserProfile: (newProfileData: Partial<UserRoleData>) => Promise<void>;
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
    } else {
      const emailLower = email.toLowerCase();
      let predictedRole: 'admin' | 'teacher' | 'student' | 'applicant' = 'applicant';
      if (emailLower.includes('admin')) predictedRole = 'admin';
      else if (emailLower.includes('teacher')) predictedRole = 'teacher';
      else if (emailLower.includes('student')) predictedRole = 'student';
      
      const defaultProfile: UserRoleData = {
        role: predictedRole,
        displayName: email.split('@')[0] || 'User',
        email
      };
      setUserData(defaultProfile);
      safeStorage.setItem(cacheKey, JSON.stringify(defaultProfile));
    }

    try {
      // Query both Supabase profile and Firestore user record in parallel with timeout safeguard
      const timeoutPromise = new Promise<{ data: null; error: string }>((resolve) => 
        setTimeout(() => resolve({ data: null, error: 'timeout' }), 2500)
      );

      const [supabaseRes, firestoreSnap] = await Promise.all([
        Promise.race([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
            .catch(err => ({ data: null, error: err })),
          timeoutPromise
        ]),
        Promise.race([
          getDoc(doc(db, "users", userId)).catch(() => null),
          new Promise<null>((res) => setTimeout(() => res(null), 2500))
        ])
      ]);

      const profile = supabaseRes && 'data' in supabaseRes ? (supabaseRes as any).data : null;
      const firestoreUser = firestoreSnap && (firestoreSnap as any).exists && (firestoreSnap as any).exists() ? (firestoreSnap as any).data() : null;

      if (profile || firestoreUser) {
        const photo = profile?.photoUrl || profile?.photo_url || firestoreUser?.photoUrl || firestoreUser?.passportUrl || firestoreUser?.passportPhoto || firestoreUser?.photoURL;
        const dataToSet: UserRoleData = {
          role: (firestoreUser?.role || profile?.role || (email.toLowerCase().includes('admin') ? 'admin' : 'applicant')) as any,
          displayName: profile?.displayName || profile?.display_name || firestoreUser?.displayName || email.split('@')[0],
          email: profile?.email || firestoreUser?.email || email,
          studentId: firestoreUser?.studentId || profile?.studentId || profile?.student_id,
          teacherId: firestoreUser?.teacherId || profile?.teacherId || profile?.teacher_id,
          photoUrl: photo,
          passportUrl: photo,
          passportPhoto: photo,
          phone: profile?.phone || profile?.phoneNumber || profile?.phone_number || firestoreUser?.phone || firestoreUser?.phoneNumber,
          phoneNumber: profile?.phone || profile?.phoneNumber || profile?.phone_number || firestoreUser?.phone || firestoreUser?.phoneNumber,
          gender: profile?.gender || firestoreUser?.gender,
          dob: profile?.dob || profile?.dateOfBirth || profile?.date_of_birth || firestoreUser?.dob || firestoreUser?.dateOfBirth,
          dateOfBirth: profile?.dob || profile?.dateOfBirth || profile?.date_of_birth || firestoreUser?.dob || firestoreUser?.dateOfBirth,
          stateOfOrigin: profile?.stateOfOrigin || profile?.state_of_origin || firestoreUser?.stateOfOrigin,
          lga: profile?.lga || firestoreUser?.lga,
          address: profile?.address || firestoreUser?.address,
          guardianName: profile?.guardianName || profile?.guardian_name || firestoreUser?.guardianName,
          guardianPhone: profile?.guardianPhone || profile?.guardian_phone || firestoreUser?.guardianPhone,
          guardianEmail: profile?.guardianEmail || profile?.guardian_email || firestoreUser?.guardianEmail,
          guardianRelationship: profile?.guardianRelationship || profile?.guardian_relationship || firestoreUser?.guardianRelationship,
          hasPaidApplication: firestoreUser?.hasPaidApplication !== undefined ? firestoreUser.hasPaidApplication : (profile?.hasPaidApplication || profile?.has_paid_application),
          admissionStatus: (firestoreUser?.admissionStatus || profile?.admissionStatus || profile?.admission_status || 'pending') as any,
          targetClass: firestoreUser?.targetClass || firestoreUser?.class || profile?.targetClass || profile?.target_class,
          class: firestoreUser?.targetClass || firestoreUser?.class || profile?.targetClass || profile?.target_class,
          examNumber: firestoreUser?.examNumber || profile?.examNumber || profile?.exam_number
        };
        addDebugLog('Auth Service', `Database profile resolved. Verified Role: "${dataToSet.role}" | Status: "${dataToSet.admissionStatus}" | Name: "${dataToSet.displayName}"`, 'success');
        setUserData(dataToSet);
        safeStorage.setItem(cacheKey, JSON.stringify(dataToSet));
      }
    } catch (err) {
      addDebugLog('Auth Service', `Database profile check finished. Error: ${err instanceof Error ? err.message : String(err)}`, 'warn');
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

  const signInSession = async (userId: string, email: string, displayName: string, explicitRole?: 'admin' | 'teacher' | 'student' | 'applicant') => {
    addDebugLog('Auth Service', `Explicitly logging in session for ${email} (${userId})`, 'success');
    safeStorage.setItem('imsc_active_user_id', userId);
    const compatUser: CompactSupabaseUser = {
      id: userId,
      uid: userId,
      email,
      displayName
    };
    setUser(compatUser);
    
    // Set immediate profile in memory so ProtectedRoute and components see it instantaneously
    const cacheKey = `imsc_user_data_${userId}`;
    const cached = safeStorage.getItem(cacheKey);
    if (cached) {
      try {
        setUserData(JSON.parse(cached));
      } catch (e) {}
    } else {
      const emailLower = email.toLowerCase();
      let roleToUse: 'admin' | 'teacher' | 'student' | 'applicant' = explicitRole || 'applicant';
      if (emailLower.includes('admin')) roleToUse = 'admin';
      else if (emailLower.includes('teacher')) roleToUse = 'teacher';
      else if (emailLower.includes('student')) roleToUse = 'student';
      
      const immediateProfile: UserRoleData = {
        role: roleToUse,
        displayName: displayName || email.split('@')[0] || 'User',
        email
      };
      setUserData(immediateProfile);
      safeStorage.setItem(cacheKey, JSON.stringify(immediateProfile));
    }

    // Refresh profile in background asynchronously
    fetchProfile(userId, email).catch(err => {
      console.warn("Background fetchProfile error:", err);
    });
  };

  const updateUserProfile = async (newProfileData: Partial<UserRoleData>) => {
    if (!user && !newProfileData) return;
    const activeId = user?.id || (newProfileData as any).studentId || safeStorage.getItem('imsc_active_user_id') || 'active_user';
    const cacheKey = `imsc_user_data_${activeId}`;

    setUserData(prev => {
      const merged = { ...(prev || ({} as UserRoleData)), ...newProfileData };
      safeStorage.setItem(cacheKey, JSON.stringify(merged));
      return merged;
    });
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
    updateUserProfile,
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
