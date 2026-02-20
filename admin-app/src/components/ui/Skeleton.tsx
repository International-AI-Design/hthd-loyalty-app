interface SkeletonProps {
  variant?: 'text' | 'card' | 'table-row' | 'circle';
  lines?: number;
  className?: string;
}

const TEXT_WIDTHS = ['w-full', 'w-4/5', 'w-3/5', 'w-11/12', 'w-2/3'];

export function Skeleton({ variant = 'text', lines = 3, className = '' }: SkeletonProps) {
  if (variant === 'circle') {
    return <div className={`animate-pulse bg-gray-200 rounded-full h-10 w-10 ${className}`} />;
  }

  if (variant === 'card') {
    return <div className={`animate-pulse bg-gray-200 rounded-xl h-32 w-full ${className}`} />;
  }

  if (variant === 'table-row') {
    return <div className={`animate-pulse bg-gray-200 rounded h-12 w-full ${className}`} />;
  }

  // text variant
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-gray-200 rounded h-4 ${TEXT_WIDTHS[i % TEXT_WIDTHS.length]}`}
        />
      ))}
    </div>
  );
}
