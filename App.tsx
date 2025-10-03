import React from 'react';
import { useAppContext } from './context/AppContext';
import Step1Configure from './components/Step1_Configure';
import PostDashboard from './components/PostDashboard';
import { Button } from './components/common/Button';
import { SparklesIcon } from './components/icons/SparklesIcon';
import ThemeToggle from './components/ThemeToggle';
import ToolGenerationModal from './components/ToolGenerationModal';

export default function App(): React.ReactNode {
  const { state, reset } = useAppContext();
  const isConnected = !!state.wpConfig;

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200 antialiased">
      <div className="container mx-auto px-4 py-6 sm:py-12">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 sm:mb-12 gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <SparklesIcon className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500" />
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
                HTML Snippet AI
              </h1>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">
                From the creators of <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">AffiliateMarketingForSuccess.com</a>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isConnected && (
               <Button onClick={reset} variant="secondary">Disconnect</Button>
            )}
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto">
          {isConnected ? <PostDashboard /> : <Step1Configure />}
        </main>
        
        <ToolGenerationModal />

        <footer className="text-center mt-16 sm:mt-24 py-10 border-t border-slate-200/50 dark:border-slate-800/50">
            <div className="max-w-4xl mx-auto px-4">
                <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="inline-block mb-6 transition-opacity hover:opacity-80">
                    <img 
                        src="https://affiliatemarketingforsuccess.com/wp-content/uploads/2023/03/cropped-Affiliate-Marketing-for-Success-Logo-Edited.png?lm=6666FEE0" 
                        alt="AffiliateMarketingForSuccess.com Logo"
                        className="h-14 w-auto mx-auto"
                        loading="lazy"
                    />
                </a>
                <p className="text-base text-slate-700 dark:text-slate-300 mb-2">
                    This App is Created by Alexios Papaioannou
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                    Owner of <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">affiliatemarketingforsuccess.com</a>
                </p>
                
                <div className="flex justify-center items-center flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Learn more about:</span>
                    <a href="https://affiliatemarketingforsuccess.com/affiliate-marketing" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors">Affiliate Marketing</a>
                    <a href="https://affiliatemarketingforsuccess.com/ai" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors">AI</a>
                    <a href="https://affiliatemarketingforsuccess.com/seo" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors">SEO</a>
                    <a href="https://affiliatemarketingforsuccess.com/blogging" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors">Blogging</a>
                    <a href="https://affiliatemarketingforsuccess.com/review" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors">Reviews</a>
                </div>
            </div>
        </footer>
      </div>
    </div>
  );
}