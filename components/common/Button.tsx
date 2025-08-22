import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'large';
}

export const Button: React.FC<ButtonProps> = ({ children, className = '', variant = 'primary', size = 'normal', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform';

  const sizeClasses = {
    normal: 'px-4 py-2 text-sm',
    large: 'px-6 py-3 text-base',
  };

  const variantClasses = {
    primary: 'border-transparent text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 focus:ring-blue-500/50 shadow-md hover:shadow-lg hover:-translate-y-0.5',
    secondary: 'border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-700/80 focus:ring-blue-500/50',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};