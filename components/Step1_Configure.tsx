

import React, { useState } from 'react';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { WordPressIcon } from './icons/WordPressIcon';
import { Input } from './common/Input';
import { WorldIcon, UserIcon, LockIcon } from './icons/FormIcons';
import { useAppContext } from '../context/AppContext';
import { Card } from './common/Card';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { CodeBracketIcon } from './icons/ToolIcons';
import { CheckIcon } from './icons/CheckIcon';
import SetupInstructions from './SetupInstructions';
import { XCircleIcon } from './icons/XCircleIcon';
import ApiConfiguration from './ApiConfiguration';
import { SparklesIcon } from './icons/SparklesIcon';

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
  const { state, connectToWordPress, retryConnection } = useAppContext();
  const [url, setUrl] = useState(state.wpConfig?.url || '');
  const [username, setUsername] = useState(state.wpConfig?.username || '');
  const [appPassword, setAppPassword] = useState('');

  const isApiKeyValid = state.apiValidationStatuses[state.selectedProvider] === 'valid';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApiKeyValid) {
        alert("Please validate your API key before connecting.");
        return;
    }
    connectToWordPress({ url, username, appPassword });
  };

  if (state.setupRequired) {
    return <SetupInstructions onRetryConnection={retryConnection} />;
  }
  
  const renderError = () => {
    if (!state.error) return null;
    
    // Handle the specific timeout connection error with a detailed, helpful message.
    if (state.error.startsWith('CONNECTION_FAILED:')) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-800 dark:text-red-200 p-6 rounded-r-lg space-y-4 my-6">
                <h3 className="text-xl font-bold flex items-center gap-3">
                    <XCircleIcon className="w-6 h-6 flex-shrink-0" />
                    Connection Failed
                </h3>
                <p>The request to your WordPress site timed out after 15 seconds. Your site may be offline or running slowly.</p>
                
                <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-700/50">
                    <h4 className="font-bold text-red-900 dark:text-red-100 mb-2">Common Causes & Solutions</h4>
                    <ul className="list-none space-y-2 text-sm pl-0">
                        <li>
                            <strong className="block">Incorrect Site URL:</strong> Please double-check for typos and make sure it starts with <code className="text-xs bg-red-100 dark:bg-red-900/50 p-1 rounded">https://</code>.
                        </li>
                        <li>
                            <strong className="block">Security Block:</strong> A firewall or security plugin (like <strong>Wordfence</strong>) on your site might be blocking API requests. Check your security plugin settings or contact your web host.
                        </li>
                        <li>
                            <strong className="block">Site Offline:</strong> Your website might be temporarily down. Please ensure you can access it in another browser tab.
                        </li>
                        <li>
                            <strong className="block">Outdated Connector Snippet:</strong> If you've used this app before, you might need to update the connector snippet. Trying to connect again should trigger the setup screen with the latest code if needed.
                        </li>
                    </ul>
                </div>
            </div>
        );
    }

    // Fallback for other errors (e.g., authentication)
    return (
        <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md my-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{state.error}</span>
        </div>
    );
  };


  return (
    <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl shadow-2xl shadow-slate-300/20 dark:shadow-black/30 p-4 sm:p-10 border border-white/20 dark:border-slate-700/80 backdrop-blur-2xl animate-fade-in space-y-10 sm:space-y-16">
       {/* Unique Features */}
      <section className="text-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
           <FeatureCard icon={<LightbulbIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="AI-Powered Quiz Generation">
              Our AI analyzes your posts to suggest and create context-aware quizzes, turning static content into interactive experiences.
           </FeatureCard>
           <FeatureCard icon={<CodeBracketIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="Interactive & Engaging">
              Receive production-ready, fully responsive, and accessible quizzes that look amazing in light and dark mode.
           </FeatureCard>
           <FeatureCard icon={<CheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="Intelligent 1-Click Insertion">
             Our placement engine analyzes your content and injects the quiz for maximum impact with a single click.
           </FeatureCard>
        </div>
      </section>

      {/* Configuration Steps */}
      <section>
        <form onSubmit={handleSubmit} className="space-y-10 max-w-2xl mx-auto">
            {renderError()}
            {/* Step 1: AI Configuration */}
            <div>
              <div className="text-center mb-6">
                <SparklesIcon className="w-14 h-14 sm:w-16 sm:h-16 mx-auto text-purple-500 dark:text-purple-400" />
                <h2 className="text-xl sm:text-2xl font-bold mt-4 text-slate-800 dark:text-slate-100">1. Configure AI Provider</h2>
                <p className="text-slate-600 dark:text-slate-400">Choose your preferred AI and enter your API key.</p>
              </div>
              <ApiConfiguration/>
            </div>

            {/* Step 2: WordPress Configuration */}
            <div className={`transition-opacity duration-500 ${!isApiKeyValid ? 'opacity-40' : ''}`}>
              <div className="text-center mb-6">
                <WordPressIcon className="w-14 h-14 sm:w-16 sm:h-16 mx-auto text-blue-500 dark:text-blue-400" />
                <h2 className="text-xl sm:text-2xl font-bold mt-4 text-slate-800 dark:text-slate-100">2. Connect to WordPress</h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Enter your site details to begin analyzing your content.
                </p>
              </div>

              <fieldset disabled={!isApiKeyValid} className="space-y-6">
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
                    This is NOT your main password. <a href="https://www.wpbeginner.com/beginners-guide/how-to-create-an-application-password-in-wordpress/" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Learn how to create one.</a>
                  </p>
                </div>
                
                <div className="pt-4">
                  <Button type="submit" size="large" className="w-full" disabled={state.status === 'loading' || !isApiKeyValid}>
                    {state.status === 'loading' ? <><Spinner /> Connecting...</> : 'Connect & Fetch Posts'}
                  </Button>
                </div>
              </fieldset>
            </div>
        </form>
      </section>

      {/* Resources */}
      <section className="text-center max-w-4xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold mt-4 text-slate-800 dark:text-slate-100">Grow Your Audience</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Level up your content strategy with these guides from our blog.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(res => <ResourceLink key={res.title} {...res} />)}
        </div>
      </section>

    </div>
  );
}
