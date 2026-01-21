import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { StaffUser } from '../lib/api';

interface AuthContextType {
  staff: StaffUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, staff: StaffUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const storedStaff = localStorage.getItem('admin_staff');

    if (token && storedStaff) {
      try {
        setStaff(JSON.parse(storedStaff));
      } catch {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_staff');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (token: string, staffData: StaffUser) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_staff', JSON.stringify(staffData));
    setStaff(staffData);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_staff');
    setStaff(null);
  };

  return (
    <AuthContext.Provider
      value={{
        staff,
        isLoading,
        isAuthenticated: !!staff,
        login,
        logout,
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
