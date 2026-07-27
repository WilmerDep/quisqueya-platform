import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { clearSession, createApiSession, isSessionValid, persistSession, readSession } from '../services/authService';
import { apiClient, ApiRequestError } from '../services/apiClient';
import { openPlatformBlockingState } from '../services/platformEvents';

interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => void;
  availableUsers: User[];
  refreshUser: () => void;
  isLoading: boolean;
  selectedBranchId: string;
  setSelectedBranchId: (branchId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const loadApiSession = useCallback(async () => {
    const savedSession = readSession();
    if (!isSessionValid(savedSession) || savedSession?.mode !== 'api' || !savedSession.accessToken) {
      clearSession();
      setCurrentUser(null);
      setAvailableUsers([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.me(savedSession.accessToken);
      setCurrentUser(response.data);
      setAvailableUsers([response.data]);
      setIsLoading(false);
      return;
    } catch {
      if (savedSession.refreshToken) {
        try {
          const refreshed = await apiClient.refresh(savedSession.refreshToken);
          persistSession(createApiSession(refreshed.user.id, refreshed.accessToken, refreshed.refreshToken));
          setCurrentUser(refreshed.user);
          setAvailableUsers([refreshed.user]);
          setIsLoading(false);
          return;
        } catch {
          // Session refresh failed. Fall through to a clean logout state.
        }
      }
    }

    clearSession();
    setCurrentUser(null);
    setAvailableUsers([]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadApiSession();
  }, [loadApiSession]);

  useEffect(() => {
    if (currentUser && !selectedBranchId) setSelectedBranchId(currentUser.branchId);
  }, [currentUser, selectedBranchId]);

  useEffect(() => {
    const handleAuthExpired = () => {
      openPlatformBlockingState({
        id: 'auth-expired',
        kind: 'session-expired',
        title: 'Sesion expirada',
        message: 'Tu sesion ha expirado por seguridad. Inicia sesion nuevamente para continuar usando la plataforma.',
        primaryLabel: 'Ir al login',
        primaryHref: '/auth',
      });
      setCurrentUser(null);
      setAvailableUsers([]);
      clearSession();
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedPassword = password.trim();

    try {
      const result = await apiClient.login({ username: normalizedUsername, password: normalizedPassword });
      persistSession(createApiSession(result.user.id, result.accessToken, result.refreshToken));
      setCurrentUser(result.user);
      setAvailableUsers([result.user]);
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && [400, 401].includes(error.status)) return false;
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setAvailableUsers([]);
    clearSession();
  };

  const refreshUser = useCallback(() => {
    void loadApiSession();
  }, [loadApiSession]);

  const switchUser = useCallback((_userId: string) => {
    // Cross-user impersonation is intentionally disabled until it is backed by
    // an audited server-side endpoint with explicit authorization.
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, switchUser, availableUsers, refreshUser, isLoading, selectedBranchId, setSelectedBranchId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
