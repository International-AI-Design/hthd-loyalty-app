import type { ReactNode } from 'react';

interface AlertProps {
  variant?: 'error' | 'success' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', children, className = '' }: AlertProps) {
  const variants = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className={`p-4 rounded-lg border ${variants[variant]} ${className}`} role="alert">
      {children}
    </div>
  );
}
