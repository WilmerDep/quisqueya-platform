
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { getUsers } from '../services/dataService';

interface AuthContextType {
  currentUser: User;
  switchUser: (userId: string) => void;
  availableUsers: User[];
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [availableUsers, setAvailableUsers] = useState<User[]>(getUsers());
  const [currentUser, setCurrentUser] = useState<User>(availableUsers[0]);

  // Sincronizar con los cambios en localStorage
  const refreshUser = () => {
    const users = getUsers();
    setAvailableUsers(users);
    const updatedSelf = users.find(u => u.id === currentUser.id);
    if (updatedSelf) {
      setCurrentUser(updatedSelf);
    }
  };

  const switchUser = (userId: string) => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, switchUser, availableUsers, refreshUser }}>
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
