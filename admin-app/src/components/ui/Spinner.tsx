interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`border-gray-200 border-t-[#62A2C3] rounded-full animate-spin ${sizes[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
