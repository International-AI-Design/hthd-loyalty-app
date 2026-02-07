import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../lib/api';
import type { CustomerProfile } from '../lib/api';

interface AuthContextType {
  customer: CustomerProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, customer: CustomerProfile) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      refreshProfile().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = async () => {
    const { data, error } = await authApi.getProfile();
    if (data && !error) {
      setCustomer(data);
    } else {
      localStorage.removeItem('token');
      setCustomer(null);
    }
  };

  const login = (token: string, customerData: CustomerProfile) => {
    localStorage.setItem('token', token);
    setCustomer(customerData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('hthd_has_visited');
    setCustomer(null);
  };

  return (
    <AuthContext.Provider
      value={{
        customer,
        isLoading,
        isAuthenticated: !!customer,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
