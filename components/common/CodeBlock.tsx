import React, { useState, useEffect, useRef } from 'react';
import { ClipboardIcon } from '../icons/ActionIcons';
import { CheckIcon } from '../icons/CheckIcon';

interface CodeBlockProps {
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom as content is added
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 dark:bg-black/50 rounded-lg shadow-lg overflow-hidden border border-slate-700/50 h-full flex flex-col">
      <div className="flex-shrink-0 flex justify-between items-center px-4 py-2 bg-slate-800/50 dark:bg-slate-900/50 border-b border-slate-700/50">
        <span className="text-xs font-mono text-slate-400">snippet.html</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          disabled={copied || !code}
        >
          {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      <div ref={codeContainerRef} className="p-4 flex-grow overflow-auto">
        <pre><code className="text-sm text-slate-100 whitespace-pre-wrap break-words">
          {code}
        </code></pre>
      </div>
    </div>
  );
};
