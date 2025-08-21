import React from 'react';
import { useAppContext } from '../context/AppContext';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';

export default function ThemeToggle(): React.ReactNode {
  const { state, setTheme } = useAppContext();
  const isDark = state.theme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center h-8 w-14 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className="sr-only">Toggle theme</span>
      <span
        className={`absolute left-1 top-1 flex items-center justify-center h-6 w-6 rounded-full bg-white dark:bg-slate-800 shadow-md transform transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        <SunIcon className={`w-4 h-4 text-yellow-500 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-100'}`} />
        <MoonIcon className={`w-4 h-4 text-slate-400 absolute transition-opacity duration-300 ${isDark ? 'opacity-100' : 'opacity-0'}`} />
      </span>
    </button>
  );
}