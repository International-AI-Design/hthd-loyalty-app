import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', label, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="flex items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={`
            h-4 w-4 rounded border-gray-300 text-brand-teal
            focus:ring-2 focus:ring-brand-teal focus:ring-offset-0
            disabled:cursor-not-allowed disabled:opacity-50
            ${className}
          `}
          {...props}
        />
        <label htmlFor={inputId} className="ml-2 text-sm text-gray-600 select-none cursor-pointer">
          {label}
        </label>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
