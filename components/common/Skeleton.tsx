import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={`bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse ${className}`}
    ></div>
  );
};