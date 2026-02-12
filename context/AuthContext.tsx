import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, Role } from '../types';
import { MOCK_USERS } from '../services/dataService';

interface AuthContextType {
  currentUser: User;
  switchUser: (userId: string) => void;
  availableUsers: User[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to Admin
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);

  const switchUser = (userId: string) => {
    const user = MOCK_USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, switchUser, availableUsers: MOCK_USERS }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};