import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { ClientProfile } from './pages/ClientProfile';
import { LoanCreate } from './pages/LoanCreate';
import { LoansPage } from './pages/LoansPage';
import { Reports } from './pages/Reports';
import { ActivityPage } from './pages/Activity';
import { UserCreateView, UserInviteView, UserPermissionsView, UserProfileView, UsersManagement } from './pages/UsersManagement';
import { RoutesPage } from './pages/RoutesPage';
import { CollectTodayPage } from './pages/CollectTodayPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { CashManagement } from './pages/CashManagement';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';

const AppRoutes: React.FC = () => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest animate-pulse">Sincronizando Nexus...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Rutas Públicas */}
      {!currentUser ? (
        <>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        /* Rutas Privadas envueltas en Layout */
        <Route element={<Layout><Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/collect-today" element={<CollectTodayPage />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientProfile />} />
            <Route path="/loans" element={<LoansPage />} />
            <Route path="/loans/new" element={<LoanCreate />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/cash" element={<CashManagement />} />
            <Route path="/users" element={<UsersManagement />} />
            <Route path="/users/new" element={<UserCreateView />} />
            <Route path="/users/invite" element={<UserInviteView />} />
            <Route path="/users/roles" element={<UserPermissionsView />} />
            <Route path="/users/:id" element={<UserProfileView />} />
            <Route path="/reports/*" element={<Reports />} />
            <Route path="/settings/*" element={<ConfigurationPage />} />
            <Route path="/master" element={<SuperAdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Layout>}>
          <Route path="*" element={<></>} />
        </Route>
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
