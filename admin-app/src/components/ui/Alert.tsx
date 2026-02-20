import type { ReactNode } from 'react';

interface AlertProps {
  variant?: 'error' | 'success' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', children, className = '' }: AlertProps) {
  const variants = {
    error: 'bg-[#E8837B]/10 border-[#E8837B]/30 text-[#E8837B]',
    success: 'bg-[#7FB685]/10 border-[#7FB685]/30 text-[#5A9A62]',
    warning: 'bg-[#F5C65D]/10 border-[#F5C65D]/30 text-[#B8941F]',
    info: 'bg-[#62A2C3]/10 border-[#62A2C3]/30 text-[#4F8BA8]',
  };

  return (
    <div className={`p-4 rounded-lg border ${variants[variant]} ${className}`} role="alert">
      {children}
    </div>
  );
}
