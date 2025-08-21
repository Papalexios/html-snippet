
import React, { useEffect, useRef, useState } from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { CheckIcon } from './icons/CheckIcon';
import { CodeBlock } from './common/CodeBlock';
import { useAppContext } from '../context/AppContext';
import { EyeIcon, CodeBracketIcon } from './icons/ToolIcons';

// Helper to convert hex to HSL, needed for theme updates.
const hexToHsl = (hex: string): { h: number, s: number, l: number } | null => {
    if (!hex || typeof hex !== 'string') return null;
    let r = 0, g = 0, b = 0;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if(result){
        r = parseInt(result[1], 16);
        g = parseInt(result[2], 16);
        b = parseInt(result[3], 16);
    } else {
        const shorthandResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
        if(shorthandResult){
            r = parseInt(shorthandResult[1] + shorthandResult[1], 16);
            g = parseInt(shorthandResult[2] + shorthandResult[2], 16);
            b = parseInt(shorthandResult[3] + shorthandResult[3], 16);
        } else {
            return null;
        }
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}


export default function Step3Generate(): React.ReactNode {
  const { state, reset, resetToAnalyze, generateSnippet, setThemeColor, insertSnippet } = useAppContext();
  const { status, error, generatedSnippet, themeColor, selectedPost, selectedIdea } = state;
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('code');
  const [iframeSrcDoc, setIframeSrcDoc] = useState('');

  const isGenerating = status === 'loading' && generatedSnippet.length === 0;
  const isInserting = status === 'loading' && generatedSnippet.length > 0;

  useEffect(() => {
    if (!generatedSnippet && status !== 'loading') {
      generateSnippet();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When a new generation starts, switch to the code tab
    if (status === 'loading') {
      setActiveTab('code');
    }
  }, [status]);

  // Effect to update the iframe srcdoc when the snippet or theme color changes
  useEffect(() => {
    if (generatedSnippet) {
      let finalSnippet = generatedSnippet;
      const hsl = hexToHsl(themeColor);
      if (hsl) {
        const newHslString = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
        // Use a regex to replace the accent color variable in the style block
        finalSnippet = generatedSnippet.replace(
          /(--accent-color:\s*)[^;]+(;)/,
          `$1${newHslString}$2`
        );
      }
      // Wrap the fragment in a full HTML document for the iframe
      setIframeSrcDoc(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body class="bg-transparent">${finalSnippet}</body></html>`);
    }
  }, [generatedSnippet, themeColor]);

  if (!selectedPost || !selectedIdea) {
    return (
      <div>
        <p>Missing post or idea selection. Please start over.</p>
        <Button onClick={reset}>Start Over</Button>
      </div>
    );
  }
  
  const handleRegenerate = () => {
    generateSnippet();
  };
  
  const handleInsert = () => {
    insertSnippet();
  };

  const renderSuccessScreen = () => (
     <Card className="text-center bg-green-50 dark:bg-green-900/50 border-green-500 animate-fade-in flex flex-col items-center justify-center min-h-[400px] sm:min-h-[500px]">
        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <CheckIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="mt-4 text-2xl font-bold text-green-800 dark:text-green-300">Snippet Inserted Successfully!</h3>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md">
          Your post <a href={selectedPost.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"  dangerouslySetInnerHTML={{ __html: `"${selectedPost.title.rendered}"` }}/> has been updated.
        </p>
        <Button onClick={resetToAnalyze} className="mt-6">Create Another Tool</Button>
      </Card>
  );

  const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
  }> = ({ label, isActive, onClick, icon, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2 sm:px-4 text-sm font-semibold rounded-t-md transition-colors border-b-2 ${
        isActive
          ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
          : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-selected={isActive}
    >
      {icon}
      {label}
    </button>
  );

  const renderContent = () => {
    if (status === 'success') {
      return renderSuccessScreen();
    }
    
    return (
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 h-full">
        {/* Left Panel: Controls */}
        <div className="lg:col-span-1 flex flex-col gap-4 sm:gap-6">
            <div>
                <h3 className="text-xl font-bold mb-2">Customize &amp; Insert</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Customize the tool, then insert it into your post.
                </p>
            </div>
            
            <Card className="p-4">
                <label htmlFor="theme-color" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Accent Color
                </label>
                <div className="mt-2 flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-md">
                    <input
                        id="theme-color"
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="w-10 h-10 p-0 border-none bg-transparent rounded cursor-pointer"
                        aria-label="Select accent color"
                    />
                    <span className="font-mono text-sm text-slate-500">{themeColor}</span>
                </div>
            </Card>

            <div className="space-y-3 mt-auto">
                 <Button onClick={handleInsert} disabled={status === 'loading' || !generatedSnippet} className="w-full" size="large">
                    {isInserting ? <><Spinner /> Inserting...</> : 'Insert into Post'}
                 </Button>
                 <Button onClick={handleRegenerate} className="w-full" variant="secondary" disabled={status === 'loading'}>
                    Regenerate Tool
                </Button>
            </div>

             {error && (
               <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm" role="alert">
                <strong className="font-bold">An Error Occurred: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}
        </div>

        {/* Right Panel: Output */}
        <div className="lg:col-span-2 flex flex-col min-h-[45vh] lg:min-h-0">
            <div className="flex items-center border-b border-slate-200 dark:border-slate-700">
              <TabButton label="Code" isActive={activeTab === 'code'} onClick={() => setActiveTab('code')} icon={<CodeBracketIcon className="w-5 h-5"/>} />
              <TabButton label="Preview" isActive={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<EyeIcon className="w-5 h-5"/>} disabled={status === 'loading'} />
            </div>

            <div className="flex-grow bg-slate-100 dark:bg-slate-900/50 rounded-b-lg p-1 border border-t-0 border-slate-200 dark:border-slate-700">
                {activeTab === 'code' && (
                    <CodeBlock code={generatedSnippet} isStreaming={isGenerating} />
                )}
                {activeTab === 'preview' && status !== 'loading' && (
                     <iframe
                        key={iframeSrcDoc} // Force re-render on srcDoc change
                        srcDoc={iframeSrcDoc}
                        title="Generated Snippet Preview"
                        className="w-full h-full border-0 rounded-md bg-white dark:bg-slate-800 shadow-inner"
                        sandbox="allow-scripts allow-forms"
                    />
                )}
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
        <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100" dangerouslySetInnerHTML={{ __html: `For post: "${selectedPost.title.rendered}"` }} />
            <p className="text-slate-500 dark:text-slate-400">Implementing idea: "{selectedIdea.title}"</p>
        </div>
        {renderContent()}
    </div>
  );
}