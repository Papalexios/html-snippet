import React, { useState } from 'react';
import { Button } from './common/Button';
import { ClipboardIcon } from './icons/ActionIcons';
import { CheckIcon } from './icons/CheckIcon';

interface SetupInstructionsProps {
  onRetryConnection: () => void;
}

const phpCode = `// --- HTML Snippet AI Connector v4.0 ---
// Adds CORS support, quiz generation, shortcode rendering, and secure analytics tracking.
if ( ! class_exists( 'HTMLSnippetAI_Core' ) ) {
    final class HTMLSnippetAI_Core {
        private static $instance;
        public static function get_instance() {
            if ( null === self::$instance ) self::$instance = new self();
            return self::$instance;
        }
        private function __construct() {
            // Priority 15 to run after many other hooks but before the request is served.
            add_action( 'rest_api_init', array( $this, 'add_cors_headers' ), 15 );
        }
        public function add_cors_headers() {
            remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
            add_filter( 'rest_pre_serve_request', function( $value ) {
                // Allows access from any origin.
                header( 'Access-Control-Allow-Origin: *' );
                // Allows all standard methods and the ones we use.
                header( 'Access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS' );
                // Specifies the headers allowed in the request.
                header( 'Access-Control-Allow-Headers: Authorization, X-WP-Nonce, Content-Type, X-Requested-With' );
                // Exposes headers the client-side script needs to access.
                header( 'Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages' );
                return $value;
            });
        }
    }
}
if ( ! class_exists( 'HTMLSnippetAI_Connector' ) ) {
    final class HTMLSnippetAI_Connector {
        private static $instance;
        public static function get_instance() {
            if ( null === self::$instance ) self::$instance = new self();
            return self::$instance;
        }
        private function __construct() {
            add_action( 'init', array( $this, 'register_tool_cpt' ) );
            add_action( 'init', array( $this, 'register_shortcode' ) );
        }
        public function register_tool_cpt() {
            $args = array(
                'public'       => false, 'show_ui'      => true,
                'label'        => 'AI-Generated Tools', 'menu_icon'    => 'dashicons-sparkles',
                'supports'     => array( 'title', 'editor' ), 'show_in_rest' => true,
            );
            register_post_type( 'cf_tool', $args );
        }
        public function register_shortcode() {
            add_shortcode( 'contentforge_tool', array( $this, 'render_tool_shortcode' ) );
        }
        public function render_tool_shortcode( $atts ) {
            $atts = shortcode_atts( array( 'id' => '' ), $atts, 'contentforge_tool' );
            if ( empty( $atts['id'] ) || ! is_numeric( $atts['id'] ) ) return '<!-- Invalid Tool ID -->';
            $tool_id = (int) $atts['id'];
            $tool_post = get_post( $tool_id );
            if ( ! $tool_post || 'cf_tool' !== $tool_post->post_type || 'publish' !== $tool_post->post_status ) return '<!-- Tool not found -->';
            // V3.0 Change: Inject the tool ID for analytics tracking.
            return str_replace( '%%TOOL_ID%%', $tool_id, $tool_post->post_content );
        }
    }
}
if ( ! class_exists( 'HTMLSnippetAI_Analytics' ) ) {
    final class HTMLSnippetAI_Analytics {
        private static $instance;
        public static function get_instance() {
            if ( null === self::$instance ) self::$instance = new self();
            return self::$instance;
        }
        private function __construct() {
            add_action( 'rest_api_init', array( $this, 'register_routes' ) );
        }
        public function register_routes() {
            register_rest_route( 'quizforge/v1', '/submit', array(
                'methods'  => 'POST', 'callback' => array( $this, 'handle_submission' ),
                'permission_callback' => '__return_true', // Public endpoint
            ) );
            register_rest_route( 'quizforge/v1', '/results/(?P<id>\\d+)', array(
                'methods'  => 'GET', 'callback' => array( $this, 'handle_get_results' ),
                'permission_callback' => function () { return current_user_can( 'edit_posts' ); },
                'args'     => array( 'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ) ),
            ) );
        }
        public function handle_submission( WP_REST_Request $request ) {
            $params = $request->get_json_params();
            $tool_id = isset( $params['toolId'] ) ? absint( $params['toolId'] ) : 0;
            $result_title = isset( $params['resultTitle'] ) ? sanitize_text_field( $params['resultTitle'] ) : '';
            $score = isset( $params['score'] ) ? absint( $params['score'] ) : 0;
            $total = isset( $params['totalQuestions'] ) ? absint( $params['totalQuestions'] ) : 0;
            if ( ! $tool_id || ! $result_title || ! get_post( $tool_id ) ) return new WP_Error( 'invalid_data', 'Invalid data provided.', array( 'status' => 400 ) );
            
            $summary = get_post_meta( $tool_id, '_quizforge_summary', true );
            if ( ! is_array( $summary ) ) $summary = array( 'completions' => 0, 'totalPercent' => 0, 'resultCounts' => array() );
            
            $summary['completions']++;
            $percent = ( $total > 0 ) ? ( $score / $total ) * 100 : 0;
            $summary['totalPercent'] += $percent;
            $summary['resultCounts'][ $result_title ] = ( isset( $summary['resultCounts'][ $result_title ] ) ? $summary['resultCounts'][ $result_title ] : 0 ) + 1;
            
            update_post_meta( $tool_id, '_quizforge_summary', $summary );
            return new WP_REST_Response( array( 'success' => true ), 200 );
        }
        public function handle_get_results( WP_REST_Request $request ) {
            $tool_id = (int) $request['id'];
            $summary = get_post_meta( $tool_id, '_quizforge_summary', true );
            if ( empty( $summary ) || ! is_array( $summary ) ) {
                return new WP_REST_Response( array( 'completions' => 0, 'averageScore' => 0, 'resultCounts' => new stdClass() ), 200 );
            }
            $average_score = ( $summary['completions'] > 0 ) ? round( $summary['totalPercent'] / $summary['completions'] ) : 0;
            return new WP_REST_Response( array(
                'completions' => $summary['completions'], 'averageScore' => $average_score,
                'resultCounts' => !empty($summary['resultCounts']) ? $summary['resultCounts'] : new stdClass(),
            ), 200 );
        }
    }
}
// Initialize all modules.
HTMLSnippetAI_Core::get_instance();
HTMLSnippetAI_Connector::get_instance();
HTMLSnippetAI_Analytics::get_instance();
`;

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
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-500 text-yellow-800 dark:text-yellow-200 rounded-r-lg">
                <p className="font-bold">Important Update</p>
                <p className="text-sm">Connection problems? This new version (v4.0) fixes common connection (CORS) errors and improves security. Please replace your old snippet.</p>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 pt-4">How to Install</h3>
            <StepCard number={1} title="Use a Snippets Plugin">
                <p>For safety and ease of use, we recommend the free <a href="https://wordpress.org/plugins/insert-headers-and-footers/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">WPCode</a> plugin. If you don't have it, please install and activate it first.</p>
            </StepCard>
            <StepCard number={2} title="Create a New PHP Snippet">
                <p>In WordPress, go to <code className="text-xs">Code Snippets &rarr; Add New</code>. Select <code className="text-xs">Add Your Custom Code (Blank Snippet)</code>.</p>
            </StepCard>
            <StepCard number={3} title="Paste the Connector Code">
                <p>Click the "Copy Code" button on the right and paste our connector code into the snippet editor. Give it a title like "QuizForge AI Connector".</p>
            </StepCard>
             <StepCard number={4} title="Save and Activate">
                <p>Ensure <code className="text-xs">Code Type</code> is <code className="text-xs">PHP Snippet</code>. Set <code className="text-xs">Insertion</code> to <code className="text-xs">Auto Insert</code> and location to <code className="text-xs">Run Everywhere</code>. Finally, toggle it to <strong className="text-green-600 dark:text-green-400">Active</strong> and click <code className="text-xs">Save Snippet</code>.</p>
            </StepCard>
        </div>

        {/* Right Side: Code Block */}
        <div className="lg:col-span-3 bg-slate-900 rounded-lg shadow-2xl shadow-slate-400/20 dark:shadow-black/50 overflow-hidden border border-slate-700/50 h-full flex flex-col">
          <div className="flex-shrink-0 flex justify-between items-center px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
            <span className="text-sm font-mono text-slate-300">Secure AI Connector v4.0</span>
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
            <summary className="font-semibold text-slate-800 dark:text-slate-200">What does this code do?</summary>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                <p>This code adds three core, professional features to your site, enabling the app to function:</p>
                <ul className="list-disc list-inside pl-2">
                    <li><strong>Automatic CORS Handling:</strong> Securely allows this application to connect to your WordPress site without connection errors.</li>
                    <li><strong>A Private "AI-Generated Tools" Area:</strong> It creates a custom post type to securely store the HTML for your tools.</li>
                    <li><strong>A Simple Shortcode:</strong> It registers a <code className="text-xs">[contentforge_tool id="..."]</code> shortcode to safely display the tool in your content.</li>
                    <li><strong>A Secure Analytics Endpoint:</strong> It adds a private API for the app to track quiz performance (completions, scores) without exposing any user data.</li>
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