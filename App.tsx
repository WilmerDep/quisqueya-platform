import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlatformShell } from './components/PlatformShell';
import { PlatformDashboardPage } from './pages/PlatformDashboardPage';
import { PlatformContactsPage } from './pages/PlatformContactsPage';
import { PlatformContactDetailPage } from './pages/PlatformContactDetailPage';
import { PlatformReportsPage } from './pages/PlatformReportsPage';
import { PlatformActivityPage } from './pages/PlatformActivityPage';
import { PlatformUsersPage } from './pages/PlatformUsersPage';
import { PlatformSettingsPage } from './pages/PlatformSettingsPage';
import { PlatformAdminPage } from './pages/PlatformAdminPage';
import { PlatformAccessPage } from './pages/PlatformAccessPage';
import { PlatformReviewsPage } from './pages/PlatformReviewsPage';

const AppRoutes: React.FC = () => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest animate-pulse">Cargando Quisqueya Platform...</p>
      </div>
    );
  }

  return (
    <Routes>
      {!currentUser ? (
        <>
          <Route path="/" element={<PlatformAccessPage />} />
          <Route path="/auth" element={<PlatformAccessPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </>
      ) : (
        <Route
          path="/*"
          element={
            <PlatformShell>
              <Routes>
                <Route path="/" element={<PlatformDashboardPage />} />
                <Route path="/activity" element={<PlatformActivityPage />} />
                <Route path="/clients" element={<PlatformContactsPage />} />
                <Route path="/clients/:id" element={<PlatformContactDetailPage />} />
                <Route path="/reviews" element={<PlatformReviewsPage />} />
                <Route path="/users" element={<PlatformUsersPage />} />
                <Route path="/users/*" element={<Navigate to="/users" replace />} />
                <Route path="/reports" element={<PlatformReportsPage />} />
                <Route path="/reports/*" element={<Navigate to="/reports" replace />} />
                <Route path="/settings" element={<PlatformSettingsPage />} />
                <Route path="/settings/*" element={<Navigate to="/settings" replace />} />
                <Route path="/master" element={<PlatformAdminPage />} />
                <Route path="/super-admin/*" element={<PlatformAdminPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </PlatformShell>
          }
        />
      )}
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;
