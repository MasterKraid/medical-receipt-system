import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, Branch } from '../types';
import { apiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  branch: Branch | null;
  loading: boolean;
  authError: string | null; // NEW: The error state now lives here
  actingAsClient: User | null; // NEW: For remote receipt entry
  setActingAsClient: (client: User | null) => void;
  login: (username: string, password: string) => Promise<void>; // CHANGED: Login no longer returns anything
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  refreshUser: () => Promise<void>; // NEW
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actingAsClient, setActingAsClient] = useState<User | null>(null);

  const refreshUser = async () => {
    try {
      const data = await apiService.getCurrentUser();
      if (data && data.user) {
        setUser(data.user);
        setBranch(data.branch);
        sessionStorage.setItem('user', JSON.stringify(data.user));
        sessionStorage.setItem('branch', JSON.stringify(data.branch));
      }
    } catch (e) {
      console.warn("Failed to refresh user session", e);
    }
  };

  useEffect(() => {
    // Check for a saved user session on initial load
    const savedUser = sessionStorage.getItem('user');
    const savedBranch = sessionStorage.getItem('branch');
    const savedActingAs = sessionStorage.getItem('actingAsClient');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      if (savedBranch) setBranch(JSON.parse(savedBranch));
      if (savedActingAs) setActingAsClient(JSON.parse(savedActingAs));

      // CRITICAL: Fetch fresh data from server to ensure wallet balance is live
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const clearAuthError = () => setAuthError(null);

  const login = async (username: string, password: string): Promise<void> => {
    setLoading(true);
    setAuthError(null); // Clear any previous errors on a new attempt
    try {
      const { user: loggedInUser, branch: userBranch } = await apiService.login(username, password);
      setUser(loggedInUser);
      setBranch(userBranch);
      sessionStorage.setItem('user', JSON.stringify(loggedInUser));
      sessionStorage.setItem('branch', JSON.stringify(userBranch));
    } catch (error) {
      // On failure, set the error state directly in the context.
      setAuthError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setBranch(null);
    setAuthError(null); // Clear errors on logout
    setActingAsClient(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('branch');
    sessionStorage.removeItem('actingAsClient');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const handleSetActingAsClient = (client: User | null) => {
    setActingAsClient(client);
    if (client) sessionStorage.setItem('actingAsClient', JSON.stringify(client));
    else sessionStorage.removeItem('actingAsClient');
  };

  const value = { user, branch, loading, authError, actingAsClient, setActingAsClient: handleSetActingAsClient, login, logout, updateUser, refreshUser, clearAuthError };

  return (
    <AuthContext.Provider value={value}>
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