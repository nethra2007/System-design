import React, { createContext, useContext, useState } from 'react';

export type UserRole = 'CUSTOMER' | 'ADMIN';

interface User {
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, role: UserRole, name?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('salestorm_user_v2');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (email: string, role: UserRole, name?: string) => {
    const userData: User = { 
      email, 
      role, 
      name: name || (role === 'ADMIN' ? 'Control Tower Operator' : email.split('@')[0] || 'Customer') 
    };
    setUser(userData);
    localStorage.setItem('salestorm_user_v2', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('salestorm_user_v2');
  };

  return (
    <AuthContext.Provider value={{ user, logout, login, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
