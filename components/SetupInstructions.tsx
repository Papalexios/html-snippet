import React from 'react';
import { Button } from './common/Button';
import { Card } from './common/Card';
import { CodeBlock } from './common/CodeBlock';
import { CheckIcon } from './icons/CheckIcon';

interface SetupInstructionsProps {
  onRetryConnection: (e: React.FormEvent) => Promise<void>;
}

const phpSnippet = `
// Creates a Custom Post Type for ContentForge AI Tools
function contentforge_register_tool_cpt() {
    $args = array(
        'public'       => false,
        'show_ui'      => true,
        'label'        => 'ContentForge Tools',
        'menu_icon'    => 'dashicons-lightbulb',
        'supports'     => array( 'title', 'editor' ),
        'show_in_rest' => true, // CRITICAL: Expose to the REST API
    );
    register_post_type( 'cf_tool', $args );
}
add_action( 'init', 'contentforge_register_tool_cpt' );

// Creates the [contentforge_tool] shortcode
function contentforge_tool_shortcode( $atts ) {
    $atts = shortcode_atts( array( 'id' => '' ), $atts, 'contentforge_tool' );

    if ( empty( $atts['id'] ) || ! is_numeric( $atts['id'] ) ) {
        return '<!-- ContentForge Tool: Invalid ID -->';
    }

    $tool_post = get_post( (int) $atts['id'] );

    if ( ! $tool_post || 'cf_tool' !== $tool_post->post_type || 'publish' !== $tool_post->post_status ) {
        return '<!-- ContentForge Tool: Tool not found or not published -->';
    }

    // Return the raw content, bypassing WordPress content filters
    return $tool_post->post_content;
}
add_shortcode( 'contentforge_tool', 'contentforge_tool_shortcode' );
`.trim();

const Step: React.FC<{ number: number; title: string; children: React.ReactNode }> = ({ number, title, children }) => (
  <li className="flex gap-4">
    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white font-bold rounded-full">{number}</div>
    <div>
      <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">{title}</h4>
      <div className="text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  </li>
);

export default function SetupInstructions({ onRetryConnection }: SetupInstructionsProps): React.ReactNode {
  return (
    <div className="animate-fade-in space-y-8">
      <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/50 text-center">
        <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
          Action Required: One-Time WordPress Setup
        </h2>
        <p className="mt-2 text-slate-700 dark:text-slate-300 max-w-3xl mx-auto">
          To guarantee your tools are 100% functional, a simple, one-time setup is needed on your WordPress site. This code enables the robust "shortcode" method that prevents WordPress from breaking the tool's script.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Instructions</h3>
          <ol className="space-y-6">
            <Step number={1} title="Install a Code Snippet Plugin">
              <p>In your WordPress admin, go to <strong>Plugins &rarr; Add New</strong> and install the free{' '}
                <a href="https://wordpress.org/plugins/code-snippets/" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  WPCode Lite
                </a> plugin. This is the safest way to add custom code.
              </p>
            </Step>
            <Step number={2} title="Create a New PHP Snippet">
              <p>Go to <strong>Code Snippets &rarr; Add Snippet</strong>, and click <strong>"Add Your Custom Code"</strong>.</p>
            </Step>
            <Step number={3} title="Paste the Code">
              <p>Give your snippet a title like "ContentForge AI Helper". Ensure the "Code Type" is set to <strong>"PHP Snippet"</strong>. Paste the code from the right into the editor.</p>
            </Step>
             <Step number={4} title="Activate the Snippet">
              <p>Scroll down to the "Insertion" section. Ensure it is set to <strong>"Auto Insert"</strong> and the "Location" is <strong>"Run Everywhere"</strong>. Toggle the snippet to <strong>"Active"</strong> and click <strong>"Save Snippet"</strong>.</p>
            </Step>
            <Step number={5} title="You're Done! Reconnect">
              <p>Once the snippet is active, come back here and click the button below to finalize the connection.</p>
            </Step>
          </ol>
        </section>

        <section>
           <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Required Code</h3>
           <CodeBlock code={phpSnippet} />
        </section>
      </div>

       <div className="text-center pt-6 border-t border-slate-200 dark:border-slate-700">
            <Button onClick={onRetryConnection} size="large">
                <CheckIcon className="w-5 h-5 mr-2"/>
                I've added the code, let's connect!
            </Button>
       </div>
    </div>
  );
}
