import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, Branch } from '../types';
import { apiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  branch: Branch | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for a saved user session on initial load
    const savedUser = sessionStorage.getItem('user');
    const savedBranch = sessionStorage.getItem('branch');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      if(savedBranch) setBranch(JSON.parse(savedBranch));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
        const { user: loggedInUser, branch: userBranch } = await apiService.login(username, password);
        setUser(loggedInUser);
        setBranch(userBranch);
        sessionStorage.setItem('user', JSON.stringify(loggedInUser));
        sessionStorage.setItem('branch', JSON.stringify(userBranch));
    } catch (error) {
        throw error;
    } finally {
        setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setBranch(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('branch');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
  };


  return (
    <AuthContext.Provider value={{ user, branch, login, logout, loading, updateUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};