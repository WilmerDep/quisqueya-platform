import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { addSecurityAuditLog, getFromStorage, seedInitialData, updateUser } from '../services/dataService';
import { clearSession, createApiSession, createSession, isSessionValid, persistSession, readSession, verifyPassword } from '../services/authService';
import { apiClient, ApiRequestError, ApiUnavailableError } from '../services/apiClient';
import { emitPlatformToast, openPlatformBlockingState } from '../services/platformEvents';

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

  const initAuth = useCallback(async () => {
    seedInitialData();
    const allUsers = getFromStorage<User[]>('prestard_users', []);
    setAvailableUsers(allUsers);

    const savedSession = readSession();
    if (isSessionValid(savedSession)) {
      if (savedSession?.mode === 'api' && savedSession.accessToken) {
        try {
          const response = await apiClient.me(savedSession.accessToken);
          setCurrentUser(response.data);
          setIsLoading(false);
          return;
        } catch {
          if (savedSession.refreshToken) {
            try {
              const refreshed = await apiClient.refresh(savedSession.refreshToken);
              persistSession(createApiSession(refreshed.user.id, refreshed.accessToken, refreshed.refreshToken));
              setCurrentUser(refreshed.user);
              setIsLoading(false);
              return;
            } catch {
              clearSession();
            }
          } else {
            clearSession();
          }
        }
      }

      if (savedSession?.mode !== 'api') {
        const user = allUsers.find(item => item.id === savedSession?.userId && item.isActive);
        if (user) {
          setCurrentUser(user);
        } else {
          clearSession();
        }
      }
    } else {
      clearSession();
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (currentUser && !selectedBranchId) {
      setSelectedBranchId(currentUser.branchId);
    }
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
      setAvailableUsers(previous => {
        const exists = previous.some(user => user.id === result.user.id);
        return exists ? previous.map(user => user.id === result.user.id ? result.user : user) : [result.user, ...previous];
      });
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError) return false;
      if (!(error instanceof ApiUnavailableError)) return false;
    }

    const allUsers = getFromStorage<User[]>('prestard_users', []);
    const user = allUsers.find(item => item.isActive && item.username.toLowerCase() === normalizedUsername);

    if (!user) {
      addSecurityAuditLog('Inicio de sesion fallido', `Usuario inexistente: ${normalizedUsername}`, { id: 'SYSTEM', name: 'Sistema', companyId: 'SYSTEM' });
      return false;
    }

    const isValidPassword = await verifyPassword(normalizedPassword, user);
    if (!isValidPassword) {
      addSecurityAuditLog('Inicio de sesion fallido', `Clave incorrecta para ${user.username}`, user);
      return false;
    }

    const updatedUser = updateUser(user.id, { lastLoginAt: new Date().toISOString() }) || user;
    setCurrentUser(updatedUser);
    persistSession(createSession(updatedUser.id));
    addSecurityAuditLog('Inicio de sesion exitoso', `Sesion iniciada para ${updatedUser.username}`, updatedUser);
    emitPlatformToast({
      title: 'Sesion iniciada en modo local',
      message: 'El panel funciona con datos locales. Para sincronizar con el servidor, vuelve a iniciar sesion cuando la API este disponible.',
      tone: 'warning',
    });
    return true;
  };

  const logout = () => {
    if (currentUser) {
      addSecurityAuditLog('Cierre de sesion', `Sesion cerrada para ${currentUser.username}`, currentUser);
    }
    setCurrentUser(null);
    clearSession();
  };

  const refreshUser = useCallback(() => {
    const allUsers = getFromStorage<User[]>('prestard_users', []);
    setAvailableUsers(allUsers);

    if (currentUser) {
      const updatedSelf = allUsers.find(user => user.id === currentUser.id);
      if (updatedSelf) {
        setCurrentUser(updatedSelf);
      } else {
        setCurrentUser(null);
        clearSession();
      }
    }
  }, [currentUser]);

  const switchUser = useCallback((userId: string) => {
    const allUsers = getFromStorage<User[]>('prestard_users', []);
    const user = allUsers.find(item => item.id === userId && item.isActive);

    if (user) {
      setCurrentUser(user);
      persistSession(createSession(user.id));
      addSecurityAuditLog('Profile switch', `Cambio manual de perfil hacia ${user.username}`, user);
      emitPlatformToast({
        title: 'Perfil cambiado en modo local',
        message: 'Este cambio rapido usa simulacion local. Las acciones administrativas no se sincronizaran con servidor hasta volver a iniciar sesion por API.',
        tone: 'warning',
      });
    }
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
