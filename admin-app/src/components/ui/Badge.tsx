import type { ReactNode } from 'react';

interface BadgePreset {
  bg: string;
  text: string;
  label: string;
}

const presets: Record<string, BadgePreset> = {
  active:     { bg: 'bg-[#62A2C3]/15', text: 'text-[#4F8BA8]', label: 'Active' },
  confirmed:  { bg: 'bg-[#62A2C3]/15', text: 'text-[#4F8BA8]', label: 'Confirmed' },
  pending:    { bg: 'bg-[#F5C65D]/20', text: 'text-[#B8941F]', label: 'Pending' },
  checked_in: { bg: 'bg-[#7FB685]/15', text: 'text-[#5A9A62]', label: 'Checked In' },
  escalated:  { bg: 'bg-[#E8837B]/15', text: 'text-[#E8837B]', label: 'Escalated' },
  closed:     { bg: 'bg-gray-100',     text: 'text-gray-500',   label: 'Closed' },
  overdue:    { bg: 'bg-[#E8837B]/15', text: 'text-[#E8837B]', label: 'Overdue' },
  cancelled:  { bg: 'bg-gray-100',     text: 'text-gray-500',   label: 'Cancelled' },
};

interface BadgeProps {
  variant: string;
  children?: ReactNode;
  className?: string;
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  const preset = presets[variant];
  const bg = preset?.bg ?? 'bg-gray-100';
  const text = preset?.text ?? 'text-gray-600';
  const label = children ?? preset?.label ?? variant;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text} ${className}`}
    >
      {label}
    </span>
  );
}
