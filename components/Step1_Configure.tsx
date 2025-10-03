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
import { SparklesIcon } from './icons/SparklesIcon';
import { CogIcon } from './icons/CogIcon';


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
  <div className="text-left p-6 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 h-full backdrop-blur-xl shadow-lg shadow-slate-200/60 dark:shadow-black/20">
    <div className="flex items-center gap-4">
      <span className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 flex items-center justify-center">
        {icon}
      </span>
      <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{title}</h3>
    </div>
    <p className="mt-4 text-slate-700 dark:text-slate-100">{children}</p>
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
        <div className="relative bg-slate-100 dark:bg-slate-800/50 rounded-md font-mono text-sm text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
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

  const StarRating = ({ rating = 5 }) => (
    <div className="flex items-center">
      {Array.from({ length: rating }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
      ))}
    </div>
  );
  

  return (
    <div className="space-y-20 sm:space-y-32">
        {/* HERO SECTION */}
        <section className="text-center relative pt-16 pb-20">
            <div className="hero-glow"></div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tighter leading-tight section-animate">
                The AI Co-Pilot for Your {" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                    WordPress Content.
                </span>
            </h1>
            <p className="mt-6 max-w-3xl mx-auto text-lg sm:text-xl text-slate-800 dark:text-slate-100 section-animate" style={{ animationDelay: '200ms' }}>
                Transform blog posts into interactive, SEO-powerhouse tools that captivate readers and dominate search rankings. No code required.
            </p>
            <div className="mt-10 section-animate" style={{ animationDelay: '400ms' }}>
              <a
                href="https://seo-hub.affiliatemarketingforsuccess.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 sm:px-10 text-base sm:text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-purple-700 rounded-full shadow-lg cta-button-glow transition-all duration-300 ease-in-out transform hover:scale-105 group"
              >
                <SparklesIcon className="w-6 h-6 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
                <span>Dominate Your Niche – Unlock Your Complete AI-Powered SEO Arsenal</span>
              </a>
            </div>
        </section>

        {/* TRUSTED BY */}
        <section className="text-center section-animate" style={{ animationDelay: '600ms' }}>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100 uppercase tracking-wider">Trusted by the best in the industry</p>
            <div className="mt-6 flex justify-center items-center gap-8 sm:gap-12 flex-wrap">
                <div className="h-8 text-slate-700 dark:text-slate-100 font-bold text-2xl">Forbes</div>
                <div className="h-8 text-slate-700 dark:text-slate-100 font-bold text-2xl">TechCrunch</div>
                <div className="h-8 text-slate-700 dark:text-slate-100 font-bold text-2xl">HubSpot</div>
                <div className="h-8 text-slate-700 dark:text-slate-100 font-bold text-2xl">Ahrefs</div>
            </div>
        </section>

      {/* HOW IT WORKS */}
      <section className="relative text-center section-animate" style={{ animationDelay: '800ms' }}>
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">From Idea to Impact in 3 Clicks</h2>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-slate-800 dark:text-slate-100">
            Our streamlined process makes enhancing your content effortless and incredibly powerful.
        </p>
        <div className="relative mt-16 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
            <div className="how-it-works-line hidden lg:block"></div>
            <div className="relative flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-500/50 flex items-center justify-center shadow-lg">
                    <WordPressIcon className="w-10 h-10 text-blue-500"/>
                </div>
                <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-slate-100">1. Connect & Analyze</h3>
                <p className="mt-2 text-slate-700 dark:text-slate-100">Securely connect your WordPress site. Our AI scans your titles to pinpoint the highest-potential posts for an interactive upgrade.</p>
            </div>
            <div className="relative flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-500/50 flex items-center justify-center shadow-lg">
                    <LightbulbIcon className="w-10 h-10 text-blue-500"/>
                </div>
                <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-slate-100">2. Generate & Customize</h3>
                <p className="mt-2 text-slate-700 dark:text-slate-100">Choose from AI-generated tool ideas tailored to your content. Watch as production-ready code is created in seconds, then customize its look.</p>
            </div>
            <div className="relative flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-500/50 flex items-center justify-center shadow-lg">
                     <CheckIcon className="w-10 h-10 text-blue-500"/>
                </div>
                <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-slate-100">3. Deploy & Dominate</h3>
                <p className="mt-2 text-slate-700 dark:text-slate-100">With a single click, our intelligent placement engine injects the tool into your post for maximum reader engagement and SEO impact.</p>
            </div>
        </div>
      </section>

       {/* Unique Features */}
      <section className="text-center section-animate" style={{ animationDelay: '1000ms' }}>
         <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">An Unfair Advantage for Your Content</h2>
         <p className="mt-4 max-w-2xl mx-auto text-lg text-slate-800 dark:text-slate-100">
            Go beyond static text and give your audience the interactive experience they crave.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
           <FeatureCard icon={<SparklesIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />} title="Elite AI Idea Engine">
              Our AI analyzes posts to suggest context-aware tools competitors can't replicate, turning content into interactive assets.
           </FeatureCard>
           <FeatureCard icon={<CodeBracketIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />} title="Masterpiece Code">
              Receive production-ready, responsive, and accessible HTML snippets built to the highest standards, complete with perfect dark mode.
           </FeatureCard>
           <FeatureCard icon={<CogIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />} title="1-Click WordPress Insertion">
             Our intelligent engine analyzes your content and surgically injects the tool for maximum impact with a single click.
           </FeatureCard>
        </div>
      </section>
      
       {/* Social Proof */}
      <section className="section-animate" style={{ animationDelay: '1200ms' }}>
        <h2 className="text-center text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Don't Just Write. Engage & Convert.
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12 max-w-5xl mx-auto">
          <Card className="!p-8 bg-white dark:bg-slate-800/80 transform hover:scale-[1.03]">
            <StarRating />
            <blockquote className="mt-4 text-slate-700 dark:text-slate-100">
              <p>"This is a quantum leap for content creators. I added a custom ROI calculator to a finance post, and my average time-on-page tripled. The quality of the generated code is simply breathtaking."</p>
              <footer className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">- Sarah J., Niche Site Owner</footer>
            </blockquote>
          </Card>
          <Card className="!p-8 bg-white dark:bg-slate-800/80 transform hover:scale-[1.03]">
            <StarRating />
            <blockquote className="mt-4 text-slate-700 dark:text-slate-100">
              <p>"As a non-coder, the ability to generate and insert flawless, interactive tools is revolutionary. It's the only tool that truly understands my content's intent and suggests relevant, high-impact enhancements."</p>
              <footer className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">- Mark T., Affiliate Blogger</footer>
            </blockquote>
          </Card>
        </div>
      </section>
      
      {/* GET STARTED (Configuration) SECTION */}
      <section className="bg-white dark:bg-slate-900/70 rounded-2xl shadow-2xl shadow-slate-200/60 dark:shadow-black/30 p-6 sm:p-10 border border-slate-200 dark:border-slate-700 backdrop-blur-2xl section-animate" style={{ animationDelay: '1400ms' }}>
        <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Ready to Get Started?</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-slate-700 dark:text-slate-100">
                It's a quick, one-time setup. Connect your accounts below to begin.
            </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
             {/* Left Side: API Config */}
            <div>
                 <h3 className="text-xl sm:text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">1. Configure AI Provider</h3>
                 <p className="text-slate-700 dark:text-slate-100 mb-6">
                  Bring your own API key. Your keys are stored securely in your browser and are never sent to our servers. <span className="font-semibold">No subscriptions, ever.</span>
                </p>
                <ApiConfiguration />
            </div>

            {/* Right Side: WP Config */}
            <div>
                <div className="flex items-center gap-4 mb-6">
                  <WordPressIcon className="w-10 h-10 text-blue-500 dark:text-blue-400" />
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">2. Connect to WordPress</h3>
                    <p className="text-slate-700 dark:text-slate-100">
                        Enter your site details to begin.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="wp-url" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
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
                    <label htmlFor="wp-username" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
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
                    <label htmlFor="wp-app-password" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
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
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-100">
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
                            Please save and validate your AI Provider API key before connecting.
                        </p>
                    )}
                  </div>
                </form>
            </div>
        </div>
      </section>

      <section className="mt-12 border-t border-slate-200 dark:border-slate-700 pt-16 section-animate" style={{ animationDelay: '1600ms' }}>
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Resources & Learning Hub
          </h2>
          <p className="mt-3 text-lg text-slate-800 dark:text-slate-100 max-w-2xl mx-auto">
            Supercharge your content strategy with insights from our blog on affiliate marketing, SEO, and AI content creation.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 max-w-6xl mx-auto">
          {resources.map((resource) => (
            <ResourceLink key={resource.url} title={resource.title} url={resource.url} />
          ))}
        </div>
      </section>
    </div>
  );
}