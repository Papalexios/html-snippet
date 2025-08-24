import React, { useState, useMemo } from 'react';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { WordPressIcon } from './icons/WordPressIcon';
import { Input } from './common/Input';
import { WorldIcon, UserIcon, LockIcon } from './icons/FormIcons';
import { useAppContext } from '../context/AppContext';
import ApiConfiguration from './ApiConfiguration';
import { Card } from './common/Card';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { CodeBracketIcon } from './icons/ToolIcons';
import { CheckIcon } from './icons/CheckIcon';
import SetupInstructions from './SetupInstructions';
import { XCircleIcon } from './icons/XCircleIcon';
import { ClipboardIcon } from './icons/ActionIcons';

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

const HtaccessCodeBlock = () => {
    const [copied, setCopied] = useState(false);
    const code = `<IfModule mod_headers.c>
Header set Access-Control-Allow-Origin "*"
</IfModule>`;

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="relative bg-slate-100 dark:bg-slate-800/50 rounded-md font-mono text-sm text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 transition-colors"
            >
                {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <ClipboardIcon className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre className="p-4 overflow-x-auto"><code>{code}</code></pre>
        </div>
    );
};


export default function Step1Configure(): React.ReactNode {
  const { state, connectToWordPress, retryConnection } = useAppContext();
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
    return <SetupInstructions onRetryConnection={retryConnection} />;
  }
  
  const renderError = () => {
    if (!state.error) return null;

    if (state.error.startsWith('CONNECTION_FAILED:')) {
        const message = state.error.replace('CONNECTION_FAILED: ', '');
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-dashed border-red-300 dark:border-red-800/50 text-red-800 dark:text-red-200 p-6 rounded-xl space-y-4 my-6">
                <h3 className="text-xl font-bold flex items-center gap-3">
                    <XCircleIcon className="w-6 h-6 flex-shrink-0" />
                    Connection Failed
                </h3>
                <p>{message}</p>
                
                <h4 className="font-bold pt-2 text-red-900 dark:text-red-100">How to Fix (Most Common Solution)</h4>
                <p className="text-sm">The most common reason for this error is a server security setting called CORS. You can often fix this by adding the following code to your <code className="text-xs bg-red-100 dark:bg-red-900/30 p-1 rounded">.htaccess</code> file, which is in the main folder of your WordPress installation.</p>
                
                <HtaccessCodeBlock />
                
                <h4 className="font-bold pt-2 text-red-900 dark:text-red-100">Other Things to Check</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                    <li><strong>Is the Site URL correct?</strong> Double-check for typos and ensure it starts with <code className="text-xs bg-red-100 dark:bg-red-900/30 p-1 rounded">https://</code>.</li>
                    <li><strong>Is your site online?</strong> Can you access it in a new browser tab?</li>
                    <li><strong>Is a firewall or security plugin blocking access?</strong> Check settings in plugins like Wordfence or in your hosting provider's dashboard.</li>
                </ul>
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
           <FeatureCard icon={<LightbulbIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="Elite AI Idea Engine">
              Our AI analyzes your posts to suggest context-aware tools that competitors can't replicate, turning static content into interactive assets.
           </FeatureCard>
           <FeatureCard icon={<CodeBracketIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="Masterpiece Code">
              Receive production-ready, fully responsive, and accessible HTML snippets built to the highest industry standards, complete with perfect dark mode.
           </FeatureCard>
           <FeatureCard icon={<CheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />} title="1-Click WordPress Insertion">
             Our intelligent placement engine analyzes your content and surgically injects the tool for maximum impact with a single click.
           </FeatureCard>
        </div>
      </section>
      
       {/* Social Proof */}
      <section>
        <h2 className="text-center text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
          Trusted by Industry-Leading Publishers
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="!p-5 bg-white dark:bg-slate-800/80">
            <blockquote className="text-slate-600 dark:text-slate-300">
              <p>"This is a quantum leap for content creators. I added a custom ROI calculator to a finance post, and my average time-on-page tripled. The quality of the generated code is simply breathtaking."</p>
              <footer className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">- Sarah J., Niche Site Owner</footer>
            </blockquote>
          </Card>
          <Card className="!p-5 bg-white dark:bg-slate-800/80">
            <blockquote className="text-slate-600 dark:text-slate-300">
              <p>"As a non-coder, the ability to generate and insert flawless, interactive tools is revolutionary. It's the only tool that truly understands my content's intent and suggests relevant, high-impact enhancements."</p>
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

          {renderError()}

          <div className="pt-2">
            <Button type="submit" disabled={state.status === 'loading' || !isApiKeyValid} className="w-full" size="large">
              {state.status === 'loading' ? <><Spinner /> Connecting...</> : 'Connect & Open Dashboard'}
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