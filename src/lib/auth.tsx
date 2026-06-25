import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { safeStorage } from './safeStorage';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CompactSupabaseUser | null>(null);
  const [userData, setUserData] = useState<UserRoleData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string) => {
    const cacheKey = `imsc_user_data_${userId}`;
    const cached = safeStorage.getItem(cacheKey);
    if (cached) {
      try {
        setUserData(JSON.parse(cached));
      } catch (e) {
        console.warn("Could not parse cached user data", e);
      }
    }

    try {
      // Query the profiles table in Supabase
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile && !error) {
        const dataToSet: UserRoleData = {
          role: profile.role || 'applicant',
          displayName: profile.displayName || profile.display_name || email.split('@')[0],
          email: profile.email || email,
          studentId: profile.studentId || profile.student_id,
          teacherId: profile.teacherId || profile.teacher_id,
          photoUrl: profile.photoUrl || profile.photo_url,
          hasPaidApplication: profile.hasPaidApplication || profile.has_paid_application,
          admissionStatus: profile.admissionStatus || profile.admission_status,
          targetClass: profile.targetClass || profile.target_class
        };
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
      console.warn("Could not retrieve online profile data, falling back to cache/defaults:", err);
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
          setUser(compatUser);
          safeStorage.setItem('imsc_active_user_id', authUser.id);
          await fetchProfile(authUser.id, authUser.email || '');
        } else {
          setUser(null);
          setUserData(null);
          safeStorage.removeItem('imsc_active_user_id');
        }
      } catch (err) {
        console.warn("Supabase Auth session load failure:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSession();

    // 2. Realtime Auth State Listeners
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser = session.user;
        const compatUser: CompactSupabaseUser = {
          id: authUser.id,
          uid: authUser.id,
          email: authUser.email,
          displayName: authUser.user_metadata?.displayName || authUser.email?.split('@')[0]
        };
        setUser(compatUser);
        safeStorage.setItem('imsc_active_user_id', authUser.id);
        await fetchProfile(authUser.id, authUser.email || '');
      } else {
        setUser(null);
        setUserData(null);
        safeStorage.removeItem('imsc_active_user_id');
      }
      setLoading(false);
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  const value = {
    user,
    userData,
    loading,
    isAdmin: userData?.role === 'admin',
    isTeacher: userData?.role === 'teacher',
    isStudent: userData?.role === 'student',
    isApplicant: userData?.role === 'applicant',
    refreshUserData
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
