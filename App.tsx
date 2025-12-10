
import React from 'react';
import { useAppContext } from './context/AppContext';
import Step1Configure from './components/Step1_Configure';
import PostDashboard from './components/PostDashboard';
import { Button } from './components/common/Button';
import { SparklesIcon } from './components/icons/SparklesIcon';
import ThemeToggle from './components/ThemeToggle';
import ToolGenerationModal from './components/ToolGenerationModal';
import QuizAnalyticsModal from './components/QuizAnalyticsModal';

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
                QuizForge AI
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
        
        {!isConnected && (
          <>
            <div className="text-center my-8 animate-fade-in">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                Turn Readers into Participants.
              </h2>
              <p className="mt-4 max-w-3xl mx-auto text-lg sm:text-xl text-slate-600 dark:text-slate-400">
                Automatically generate interactive quizzes from your content. Captivate your audience, boost engagement, and increase time-on-page.
              </p>
            </div>

            <div className="text-center mb-12 animate-fade-in" style={{ animationDelay: '200ms' }}>
              <a
                href="https://seo-hub.affiliatemarketingforsuccess.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 px-6 py-4 sm:px-8 text-base sm:text-lg font-bold text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-purple-500/40 focus:outline-none focus:ring-4 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 transition-all duration-300 ease-in-out transform hover:scale-105 group"
              >
                <SparklesIcon className="w-6 h-6 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
                <span>Dominate Your Niche – Unlock Your Complete AI-Powered SEO Arsenal</span>
              </a>
            </div>
          </>
        )}

        <main className="max-w-7xl mx-auto">
          {isConnected ? <PostDashboard /> : <Step1Configure />}
        </main>
        
        <ToolGenerationModal />
        <QuizAnalyticsModal />

        <footer className="text-center mt-8 sm:mt-12 py-8 border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="flex flex-col items-center gap-4">
            <img
              src="https://affiliatemarketingforsuccess.com/wp-content/uploads/2023/03/cropped-Affiliate-Marketing-for-Success-Logo-Edited.png?lm=6666FEE0"
              alt="Affiliate Marketing for Success Logo"
              className="h-16 w-auto"
            />
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg">
              This App is Created by Alexios Papaioannou, Owner of <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">affiliatemarketingforsuccess.com</a>
            </p>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              <p className="font-semibold mb-3">Learn more about:</p>
              <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
                <a href="https://affiliatemarketingforsuccess.com/affiliate-marketing" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Affiliate Marketing</a>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">&bull;</span>
                <a href="https://affiliatemarketingforsuccess.com/ai" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">AI</a>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">&bull;</span>
                <a href="https://affiliatemarketingforsuccess.com/seo" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">SEO</a>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">&bull;</span>
                <a href="https://affiliatemarketingforsuccess.com/blogging" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Blogging</a>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">&bull;</span>
                <a href="https://affiliatemarketingforsuccess.com/review" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Reviews</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
