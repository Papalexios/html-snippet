import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border border-slate-200 dark:border-slate-700 transition-all duration-300 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 ${className}`}
    >
      {children}
    </div>
  );
};