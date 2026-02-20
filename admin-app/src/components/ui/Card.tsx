import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, title, subtitle, headerRight, className = '', noPadding = false }: CardProps) {
  const hasHeader = title || subtitle || headerRight;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between p-5 sm:p-6 pb-0 sm:pb-0 mb-4">
          <div>
            {title && (
              <h2 className="font-heading text-lg font-semibold text-[#1B365D]">{title}</h2>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5 sm:p-6' + (hasHeader ? ' pt-0 sm:pt-0' : '')}>
        {children}
      </div>
    </div>
  );
}
