import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ icon, className, ...props }) => {
  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        </div>
      )}
      <input
        {...props}
        className={`block w-full rounded-md border-0 py-2.5 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all duration-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400 ${
          icon ? 'pl-10' : 'px-3'
        } ${className || ''}`}
      />
    </div>
  );
};