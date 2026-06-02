import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

interface UserRoleData {
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

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserRoleData | null;
  loading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isApplicant: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserRoleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Load cached user data from localStorage for near-instant offline access
        const cacheKey = `imsc_user_data_${user.uid}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            setUserData(JSON.parse(cached));
          } catch (e) {
            console.warn("Could not parse cached user data", e);
          }
        }

        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const dataToSet = docSnap.data() as UserRoleData;
            setUserData(dataToSet);
            localStorage.setItem(cacheKey, JSON.stringify(dataToSet));
          } else {
            // Auto-provision if missing from Firebase console sign-up
            const email = user.email || '';
            const emailLower = email.toLowerCase();
            let role: 'admin' | 'teacher' | 'student' | 'applicant' = 'applicant';
            
            if (emailLower.includes('admin')) {
              role = 'admin';
            } else if (emailLower.includes('teacher')) {
              role = 'teacher';
            } else if (emailLower.includes('student')) {
              role = 'student';
            }

            const dataToSet: UserRoleData & { createdAt: string } = {
              role,
              displayName: user.displayName || email.split('@')[0] || 'Console User',
              email,
              createdAt: new Date().toISOString()
            };

            await setDoc(docRef, dataToSet);
            setUserData(dataToSet);
            localStorage.setItem(cacheKey, JSON.stringify(dataToSet));
          }
        } catch (error: any) {
          if (error && typeof error.message === 'string' && error.message.includes('offline')) {
            console.warn("Working offline fallback. Failed to fetch user document because client is offline.");
          } else {
            console.warn("Could not fetch user data. Fallback active:", error?.message || error);
          }
          
          // Fallback mechanism: if offline and no cache is present, predict role to keep app usable
          if (!localStorage.getItem(cacheKey)) {
            const email = user.email || 'guest@school.com';
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
              displayName: user.displayName || email.split('@')[0] || 'Offline User',
              email
            };
            setUserData(fallbackUser);
          }
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    userData,
    loading,
    isAdmin: userData?.role === 'admin',
    isTeacher: userData?.role === 'teacher',
    isStudent: userData?.role === 'student',
    isApplicant: userData?.role === 'applicant',
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
