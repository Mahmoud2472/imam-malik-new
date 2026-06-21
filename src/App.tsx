import React from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import PublicLayout from './components/public/PublicLayout';
import HomePage from './components/public/HomePage';
import AboutPage from './components/public/AboutPage';
import AdmissionPage from './components/public/AdmissionPage';
import GalleryPage from './components/public/GalleryPage';
import ContactPage from './components/public/ContactPage';
import LoginPage from './components/auth/LoginPage';
import AdminDashboard from './components/admin/AdminDashboard';
import StudentDashboard from './components/student/StudentDashboard';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import LoadingScreen from './components/shared/LoadingScreen';

function QueryRedirector() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    // Helper to search query parameters from searchParams, window.location.search, or window.location.hash
    const getParam = (name: string) => {
      if (searchParams.get(name)) return searchParams.get(name);
      
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get(name)) return urlParams.get(name);
      
      const hashPart = window.location.hash;
      const hashQueryIndex = hashPart.indexOf('?');
      if (hashQueryIndex !== -1) {
        const hashParams = new URLSearchParams(hashPart.substring(hashQueryIndex));
        if (hashParams.get(name)) return hashParams.get(name);
      }
      return null;
    };

    const ref = getParam('reference') || getParam('trxref');
    const returnTo = getParam('return-to');
    
    if (ref) {
      // Gather all search parameters dynamically
      const urlParams = new URLSearchParams(window.location.search);
      const hashPart = window.location.hash;
      const hashQueryIndex = hashPart.indexOf('?');
      const combinedParams = new URLSearchParams();
      
      for (const [k, v] of searchParams.entries()) combinedParams.set(k, v);
      for (const [k, v] of urlParams.entries()) combinedParams.set(k, v);
      if (hashQueryIndex !== -1) {
        const hashParams = new URLSearchParams(hashPart.substring(hashQueryIndex));
        for (const [k, v] of hashParams.entries()) combinedParams.set(k, v);
      }
      
      const searchStr = combinedParams.toString();
      navigate(`/admission?${searchStr}`, { replace: true });
    } else if (returnTo && !window.location.hash.includes('/auth') && !window.location.pathname.includes('/auth')) {
      const urlParams = new URLSearchParams(window.location.search);
      const hashPart = window.location.hash;
      const hashQueryIndex = hashPart.indexOf('?');
      const combinedParams = new URLSearchParams();
      
      for (const [k, v] of searchParams.entries()) combinedParams.set(k, v);
      for (const [k, v] of urlParams.entries()) combinedParams.set(k, v);
      if (hashQueryIndex !== -1) {
        const hashParams = new URLSearchParams(hashPart.substring(hashQueryIndex));
        for (const [k, v] of hashParams.entries()) combinedParams.set(k, v);
      }
      combinedParams.delete('return-to');
      const searchStr = combinedParams.toString();
      navigate(`/${returnTo}${searchStr ? '?' + searchStr : ''}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return null;
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, userData, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" />;
  if (role && userData?.role !== role) {
    // If user is logged in but role doesn't match, redirect to their correct dashboard
    if (userData?.role === 'admin') return <Navigate to="/admin" />;
    if (userData?.role === 'teacher') return <Navigate to="/teacher" />;
    if (userData?.role === 'student') return <Navigate to="/student" />;
    if (userData?.role === 'applicant') return <Navigate to="/admission" />;
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <QueryRedirector />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="admission" element={<AdmissionPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="contact" element={<ContactPage />} />
          </Route>

          {/* Auth */}
          <Route path="/auth" element={<LoginPage />} />

          {/* Protected Dashboards */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/*"
            element={
              <ProtectedRoute role="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/*"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
