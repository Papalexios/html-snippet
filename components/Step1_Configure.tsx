import React, { useState, useMemo } from 'react';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { WordPressIcon } from './icons/WordPressIcon';
import { Input } from './common/Input';
import { WorldIcon, UserIcon, LockIcon } from './icons/FormIcons';
import { useAppContext } from '../context/AppContext';
import { Step } from '../types';
import ApiConfiguration from './ApiConfiguration';
import { Card } from './common/Card';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { ChartIcon } from './icons/ToolIcons';
import { CheckIcon } from './icons/CheckIcon';
import SetupInstructions from './SetupInstructions';

const ResourceLink: React.FC<{ title: string; url: string }> = ({ title, url }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="block text-left no-underline group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded-xl">
    <Card className="h-full !p-4 group-hover:shadow-xl group-hover:border-blue-500 dark:group-hover:border-blue-500 transition-all duration-300">
      <div className="flex justify-between items-center gap-4">
        <h4 className="font-bold text-slate-800 dark:text-slate-100">{title}</h4>
        <ArrowRightIcon className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors flex-shrink-0" />
      </div>
    </Card>
  </a>
);

const resources = [
  { title: "Beginner's Guide to Affiliate Marketing", url: "https://affiliatemarketingforsuccess.com/affiliate-marketing/beginners-guide-to-affiliate-marketing/" },
  { title: "Create a Winning Content Strategy", url: "https://affiliatemarketingforsuccess.com/blogging/winning-content-strategy/" },
  { title: "A Complete Guide to SEO Writing", url: "https://affiliatemarketingforsuccess.com/seo/seo-writing-a-complete-guide-to-seo-writing/" },
  { title: "The Future of SEO with AI", url: "https://affiliatemarketingforsuccess.com/ai/ai-future-of-seo/" },
  { title: "How to Choose Your Web Host", url: "https://affiliatemarketingforsuccess.com/how-to-start/how-to-choose-a-web-host/" },
  { title: "Monetize Your Blog: Proven Strategies", url: "https://affiliatemarketingforsuccess.com/blogging/monetize-your-blog-proven-strategies/" }
];

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="text-left p-5 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 h-full">
    <div className="flex items-center gap-4">
      <span className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
        {icon}
      </span>
      <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{title}</h3>
    </div>
    <p className="mt-3 text-slate-600 dark:text-slate-300 text-sm">{children}</p>
  </div>
);

export default function Step1Configure(): React.ReactNode {
  const { state, connectToWordPress } = useAppContext();
  const [url, setUrl] = useState(state.wpConfig?.url || '');
  const [username, setUsername] = useState(state.wpConfig?.username || '');
  const [appPassword, setAppPassword] = useState('');

  const isApiKeyValid = useMemo(() => {
    return state.apiValidationStatuses[state.selectedProvider] === 'valid';
  }, [state.apiValidationStatuses, state.selectedProvider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApiKeyValid) return;
    connectToWordPress({ url, username, appPassword });
  };

  if (state.setupRequired) {
    return <SetupInstructions onRetryConnection={handleSubmit} />;
  }

  return (
    <div className="animate-fade-in space-y-10 sm:space-y-16">
       {/* Unique Features */}
      <section className="text-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
           <FeatureCard icon={<LightbulbIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="Exclusive AI Idea Engine">
              Unlike others, our AI analyzes your post to suggest unique, context-aware tools that competitors can't replicate.
           </FeatureCard>
           <FeatureCard icon={<CheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="1-Click WordPress Insertion">
              No more messy shortcodes. We inject flawless, responsive code perfectly into your post with a single click.
           </FeatureCard>
           <FeatureCard icon={<ChartIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="Industry-Leading SEO Boost">
             Turn passive readers into active users. Increase time-on-page and signal topical authority to Google.
           </FeatureCard>
        </div>
      </section>
      
       {/* Social Proof */}
      <section>
        <h2 className="text-center text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
          Trusted by Bloggers Who Lead
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="!p-5 bg-white dark:bg-slate-800/80">
            <blockquote className="text-slate-600 dark:text-slate-300">
              <p>"ContentForge is a game-changer. I added a calculator to a finance post, and my engagement time doubled overnight. My competitors are still just writing paragraphs."</p>
              <footer className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">- Sarah J., Niche Site Owner</footer>
            </blockquote>
          </Card>
          <Card className="!p-5 bg-white dark:bg-slate-800/80">
            <blockquote className="text-slate-600 dark:text-slate-300">
              <p>"I'm not a coder, but now I can create professional interactive tools in minutes. It's the only tool that truly understands my content and suggests relevant enhancements."</p>
              <footer className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">- Mark T., Affiliate Blogger</footer>
            </blockquote>
          </Card>
        </div>
      </section>

      {/* API Configuration */}
      <section>
         <h2 className="text-xl sm:text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">1. Configure AI Provider</h2>
         <p className="text-slate-600 dark:text-slate-400 mb-6">
          Bring your own API key. Your keys are stored securely in your browser and are never sent to our servers. <span className="font-semibold">No subscriptions, ever.</span>
        </p>
        <ApiConfiguration />
      </section>

      {/* WordPress Configuration */}
      <section>
        <div className="text-center mb-8">
          <WordPressIcon className="w-14 h-14 sm:w-16 sm:h-16 mx-auto text-blue-500 dark:text-blue-400" />
          <h2 className="text-xl sm:text-2xl font-bold mt-4 text-slate-800 dark:text-slate-100">2. Connect to WordPress</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Enter your site details to begin analyzing your content.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
          <div>
            <label htmlFor="wp-url" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">
              WordPress Site URL
            </label>
            <div className="mt-2">
              <Input
                id="wp-url"
                type="url"
                icon={<WorldIcon className="w-5 h-5" />}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                required
                disabled={state.status === 'loading'}
              />
            </div>
          </div>

          <div>
            <label htmlFor="wp-username" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">
              WordPress Username
            </label>
            <div className="mt-2">
              <Input
                id="wp-username"
                type="text"
                icon={<UserIcon className="w-5 h-5" />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                required
                disabled={state.status === 'loading'}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="wp-app-password" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">
              Application Password
            </label>
            <div className="mt-2">
              <Input
                id="wp-app-password"
                type="password"
                icon={<LockIcon className="w-5 h-5" />}
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                required
                disabled={state.status === 'loading'}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Generate this from your WordPress profile page under "Application Passwords". Do not use your main password.
            </p>
          </div>

          {state.error && state.currentStep === Step.Configure && (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{state.error}</span>
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={state.status === 'loading' || !isApiKeyValid} className="w-full" size="large">
              {state.status === 'loading' ? <><Spinner /> Connecting...</> : 'Connect & Fetch Posts'}
            </Button>
            {!isApiKeyValid && (
                <p className="mt-2 text-xs text-center text-yellow-600 dark:text-yellow-400">
                    Please save and validate your API key before connecting to WordPress.
                </p>
            )}
          </div>
        </form>
      </section>

      <section className="mt-12 border-t border-slate-200 dark:border-slate-700 pt-8">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
            Resources & Learning Hub
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Supercharge your content strategy with insights from our blog on affiliate marketing, SEO, and AI content creation.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8 max-w-5xl mx-auto">
          {resources.map((resource) => (
            <ResourceLink key={resource.url} title={resource.title} url={resource.url} />
          ))}
        </div>
      </section>
    </div>
  );
}