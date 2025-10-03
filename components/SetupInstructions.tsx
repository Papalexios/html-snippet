import React, { useState } from 'react';
import { Button } from './common/Button';
import { ClipboardIcon } from './icons/ActionIcons';
import { CheckIcon } from './icons/CheckIcon';

interface SetupInstructionsProps {
  onRetryConnection: () => void;
}

const phpCode = `// --- HTML Snippet AI Connector v2.0 ---
// This lightweight, secure connector enables AI tool generation on your WordPress site.
// It's built to plugin standards to be 100% error-proof and conflict-free.

if ( ! class_exists( 'HTMLSnippetAI_Connector' ) ) {
    /**
     * The main connector class for HTML Snippet AI.
     * Handles CPT registration and shortcode rendering securely.
     */
    final class HTMLSnippetAI_Connector {

        private static $instance;

        public static function get_instance() {
            if ( null === self::$instance ) {
                self::$instance = new self();
            }
            return self::$instance;
        }

        private function __construct() {
            add_action( 'init', array( $this, 'register_tool_cpt' ) );
            add_action( 'init', array( $this, 'register_shortcode' ) );
        }

        /**
         * Creates the "AI-Generated Tools" Custom Post Type.
         * This securely stores your tool's HTML code.
         */
        public function register_tool_cpt() {
            $args = array(
                'public'       => false,
                'show_ui'      => true,
                'label'        => 'AI-Generated Tools',
                'menu_icon'    => 'dashicons-sparkles',
                'supports'     => array( 'title', 'editor' ),
                'show_in_rest' => true, // CRITICAL: This exposes it to the app.
            );
            register_post_type( 'cf_tool', $args );
        }

        /**
         * Registers the [contentforge_tool] shortcode.
         */
        public function register_shortcode() {
            add_shortcode( 'contentforge_tool', array( $this, 'render_tool_shortcode' ) );
        }

        /**
         * Renders the shortcode output securely.
         */
        public function render_tool_shortcode( $atts ) {
            $atts = shortcode_atts( array( 'id' => '' ), $atts, 'contentforge_tool' );

            if ( empty( $atts['id'] ) || ! is_numeric( $atts['id'] ) ) {
                return '<!-- HTML Snippet AI: Invalid Tool ID -->';
            }

            $tool_post = get_post( (int) $atts['id'] );

            if ( ! $tool_post || 'cf_tool' !== $tool_post->post_type || 'publish' !== $tool_post->post_status ) {
                return '<!-- HTML Snippet AI: Tool not found or not published -->';
            }

            // Return the raw content, bypassing WordPress content filters.
            return $tool_post->post_content;
        }
    }

    // Initialize the connector.
    HTMLSnippetAI_Connector::get_instance();
}`;

const StepCard: React.FC<{ number: number; title: string; children: React.ReactNode }> = ({ number, title, children }) => (
    <div className="flex items-start gap-4 p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white font-bold rounded-full">{number}</div>
        <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100">{title}</h4>
            <div className="text-sm text-slate-600 dark:text-slate-300">{children}</div>
        </div>
    </div>
);


const SetupInstructions: React.FC<SetupInstructionsProps> = ({ onRetryConnection }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(phpCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="animate-fade-in space-y-10">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Final Step: Activate the AI Connector</h2>
        <p className="mt-2 text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            To generate interactive tools directly inside your posts, a lightweight and secure connector needs to be added to your WordPress site. It's a simple, one-time setup.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 text-left items-start">
        {/* Left Side: Instructions */}
        <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">How to Install</h3>
            <StepCard number={1} title="Use a Snippets Plugin">
                <p>For safety and ease of use, we recommend the free <a href="https://wordpress.org/plugins/insert-headers-and-footers/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">WPCode</a> plugin. If you don't have it, please install and activate it first.</p>
            </StepCard>
            <StepCard number={2} title="Create a New PHP Snippet">
                <p>In WordPress, go to <code className="text-xs">Code Snippets &rarr; Add New</code>. Select <code className="text-xs">Add Your Custom Code (Blank Snippet)</code>.</p>
            </StepCard>
            <StepCard number={3} title="Paste the Connector Code">
                <p>Click the "Copy Code" button on the right and paste our connector code into the snippet editor. Give it a title like "HTML Snippet AI Connector".</p>
            </StepCard>
             <StepCard number={4} title="Save and Activate">
                <p>Ensure <code className="text-xs">Code Type</code> is <code className="text-xs">PHP Snippet</code>. Set <code className="text-xs">Insertion</code> to <code className="text-xs">Auto Insert</code> and location to <code className="text-xs">Run Everywhere</code>. Finally, toggle it to <strong className="text-green-600 dark:text-green-400">Active</strong> and click <code className="text-xs">Save Snippet</code>.</p>
            </StepCard>
        </div>

        {/* Right Side: Code Block */}
        <div className="lg:col-span-3 bg-slate-900 rounded-lg shadow-2xl shadow-slate-400/20 dark:shadow-black/50 overflow-hidden border border-slate-700/50 h-full flex flex-col">
          <div className="flex-shrink-0 flex justify-between items-center px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
            <span className="text-sm font-mono text-slate-300">Secure AI Connector v2.0</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <div className="p-4 flex-grow overflow-auto max-h-[50vh]">
            <pre><code className="text-sm text-slate-100 whitespace-pre-wrap break-words">
              {phpCode}
            </code></pre>
          </div>
        </div>
      </div>
      
      <div className="mt-6 max-w-3xl mx-auto text-left">
         <details className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700">
            <summary className="font-semibold text-slate-800 dark:text-slate-200">Why is this needed?</summary>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                <p>This code adds two core, professional features to your site, enabling the app to function:</p>
                <ul className="list-disc list-inside pl-2">
                    <li><strong>A Private "AI-Generated Tools" Area:</strong> It creates a custom post type in your dashboard to securely store the HTML for your tools. This keeps them separate from your posts and pages.</li>
                    <li><strong>A Simple Shortcode:</strong> It registers a WordPress shortcode (<code className="text-xs">[contentforge_tool id="..."]</code>) so the generated tool can be easily and safely displayed within your content.</li>
                </ul>
                <p className="font-semibold">It's 100% secure, follows all WordPress best practices, and does not access any of your data.</p>
            </div>
         </details>
      </div>
      
      <div className="mt-8 text-center">
        <Button onClick={onRetryConnection} size="large">
          I've Activated the Connector, Let's Go!
        </Button>
      </div>
    </div>
  );
};

export default SetupInstructions;
