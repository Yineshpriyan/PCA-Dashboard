import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthSession, User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedSession = localStorage.getItem('pca_session');
    if (savedSession) {
      try {
        const session: AuthSession = JSON.parse(savedSession);
        setUser(session.user);
      } catch (e) {
        localStorage.removeItem('pca_session');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('pca_session', JSON.stringify({ user: userData }));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pca_session');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
