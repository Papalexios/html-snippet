import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl shadow-lg shadow-slate-300/10 dark:shadow-black/20 p-6 border border-slate-200/80 dark:border-slate-700/60 transition-all duration-300 hover:shadow-2xl hover:border-blue-400 dark:hover:border-blue-500 hover:scale-[1.02] ${className}`}
    >
      {children}
    </div>
  );
};