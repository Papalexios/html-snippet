import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Button } from './common/Button';
import { Card } from './common/Card';
import { Spinner } from './common/Spinner';
import { Skeleton } from './common/Skeleton';
import { DynamicIcon } from './icons/DynamicIcon';
import { ToolIdea, Placement } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { CodeBlock } from './common/CodeBlock';
import { EyeIcon, CodeBracketIcon } from './icons/ToolIcons';
import { XCircleIcon } from './icons/XCircleIcon';
import { ClipboardIcon } from './icons/ActionIcons';
import { SparklesIcon } from './icons/SparklesIcon';

const loadingMessages = [
    "Analyzing post for key topics...",
    "Brainstorming engaging quiz concepts...",
    "Evaluating potential for SEO lift...",
    "Cross-referencing with content strategy...",
    "Finalizing creative ideas..."
];

const IdeaCard: React.FC<{ idea: ToolIdea, onSelect: () => void, isSelected: boolean }> = ({ idea, onSelect, isSelected }) => (
    <button onClick={onSelect} className={`w-full text-left transition-all duration-300 ease-out rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/50 ${isSelected ? 'shadow-2xl shadow-blue-500/20' : ''}`}>
        <Card className={`h-full flex flex-col justify-between text-left transition-all group ${isSelected ? '!border-blue-500' : ''}`}>
            <div>
                <div className="flex items-center gap-3">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                        <DynamicIcon name={idea.icon} className={`w-5 h-5 transition-colors ${isSelected ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
                    </span>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{idea.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{idea.description}</p>
            </div>
        </Card>
    </button>
);

const SkeletonIdeaCard: React.FC = () => (
    <Card className="space-y-4">
        <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
    </Card>
);

const hexToHsl = (hex: string): { h: number, s: number, l: number } | null => {
    if (!hex || typeof hex !== 'string') return null;
    let r = 0, g = 0, b = 0;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if(result){
        r = parseInt(result[1], 16); g = parseInt(result[2], 16); b = parseInt(result[3], 16);
    } else {
        const shorthandResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
        if(shorthandResult){
            r = parseInt(shorthandResult[1] + shorthandResult[1], 16); g = parseInt(shorthandResult[2] + shorthandResult[2], 16); b = parseInt(shorthandResult[3] + shorthandResult[3], 16);
        } else { return null; }
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

const PlacementOption: React.FC<{
    value: Placement;
    title: string;
    description: string;
    icon: React.ReactNode;
    currentPlacement: Placement;
    setPlacement: (placement: Placement) => void;
}> = ({ value, title, description, icon, currentPlacement, setPlacement }) => (
    <label htmlFor={`placement-${value}`} className={`block p-4 rounded-xl border-2 transition-all cursor-pointer ${currentPlacement === value ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-lg' : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
        <input type="radio" id={`placement-${value}`} name="placement" value={value} checked={currentPlacement === value} onChange={() => setPlacement(value)} className="sr-only" />
        <div className="flex items-center gap-3">
            <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${currentPlacement === value ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                {icon}
            </span>
            <h4 className="font-bold text-slate-900 dark:text-slate-100">{title}</h4>
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 pl-11">{description}</p>
    </label>
);


export default function ToolGenerationModal() {
    const { state, closeToolGenerationModal, generateIdeasForModal, selectIdea, generateSnippetForModal, insertSnippet, setThemeColor } = useAppContext();
    const { isToolGenerationModalOpen, activePostForModal, modalStatus, modalError, toolIdeas, selectedIdea, generatedSnippet, themeColor, manualShortcode } = state;

    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
    const [iframeSrcDoc, setIframeSrcDoc] = useState('');
    const [placement, setPlacement] = useState<Placement>('ai');
    const [shortcodeCopied, setShortcodeCopied] = useState(false);

    const isGeneratingIdeas = modalStatus === 'loading' && toolIdeas.length === 0;
    const isGeneratingSnippet = modalStatus === 'loading' && !!selectedIdea && generatedSnippet.length === 0;
    const isInserting = modalStatus === 'loading' && generatedSnippet.length > 0 && !isGeneratingSnippet;

    const currentStage = useMemo(() => {
        if (modalStatus === 'success') return 'success';
        if (selectedIdea) return 'generate';
        return 'ideas';
    }, [modalStatus, selectedIdea]);

    useEffect(() => {
        if (isToolGenerationModalOpen && !activePostForModal) {
            closeToolGenerationModal();
        } else if (isToolGenerationModalOpen && toolIdeas.length === 0 && modalStatus === 'idle') {
            generateIdeasForModal();
        }
    }, [isToolGenerationModalOpen, activePostForModal, toolIdeas.length, modalStatus, generateIdeasForModal, closeToolGenerationModal]);

    useEffect(() => {
        if (selectedIdea && generatedSnippet.length === 0 && modalStatus !== 'loading') {
            generateSnippetForModal();
        }
    }, [selectedIdea, generatedSnippet.length, modalStatus, generateSnippetForModal]);

    useEffect(() => {
        if (isGeneratingIdeas) {
            const intervalId = setInterval(() => {
                setLoadingMessage(prev => loadingMessages[(loadingMessages.indexOf(prev) + 1) % loadingMessages.length]);
            }, 2500);
            return () => clearInterval(intervalId);
        }
    }, [isGeneratingIdeas]);

    useEffect(() => {
        if (isGeneratingSnippet) setActiveTab('code');
    }, [isGeneratingSnippet]);

    useEffect(() => {
        if (generatedSnippet) {
            let finalSnippet = generatedSnippet;
            const hsl = hexToHsl(themeColor);
            if (hsl) {
                const baseHsl = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
                const hoverHsl = `${hsl.h} ${hsl.s}% ${Math.max(0, hsl.l - 8)}%`;
                const focusRingHsl = `${hsl.h} ${hsl.s}% ${Math.min(100, hsl.l + 20)}%`;
                finalSnippet = finalSnippet.replace(/(--accent-color:\s*)[^;]+(;)/, `$1${baseHsl}$2`).replace(/(--accent-color-hover:\s*)[^;]+(;)/, `$1${hoverHsl}$2`).replace(/(--accent-color-focus-ring:\s*)[^;]+(;)/, `$1${focusRingHsl}$2`);
            }
            setIframeSrcDoc(`<!DOCTYPE html><html class="${state.theme}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="background-color: transparent;">${finalSnippet}</body></html>`);
        }
    }, [generatedSnippet, themeColor, state.theme]);
    
    const handleCopyShortcode = () => {
        if (!manualShortcode) return;
        navigator.clipboard.writeText(manualShortcode);
        setShortcodeCopied(true);
        setTimeout(() => setShortcodeCopied(false), 2500);
    };

    if (!isToolGenerationModalOpen || !activePostForModal) return null;

    const renderIdeasStage = () => (
        <>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-800 dark:text-slate-100">1. Choose a Quiz Idea</h2>
            {isGeneratingIdeas ? (
                 <div className="text-center">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        <SkeletonIdeaCard/>
                        <SkeletonIdeaCard/>
                        <SkeletonIdeaCard/>
                    </div>
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 animate-pulse">{loadingMessage}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {toolIdeas.map((idea, index) => (
                        <IdeaCard key={index} idea={idea} onSelect={() => selectIdea(idea)} isSelected={false}/>
                    ))}
                </div>
            )}
        </>
    );
    
    const TabButton: React.FC<{label: string; isActive: boolean; onClick: () => void; icon: React.ReactNode; disabled?: boolean;}> = ({ label, isActive, onClick, icon, disabled }) => (
        <button onClick={onClick} disabled={disabled} className={`flex items-center gap-2 px-3 py-2 sm:px-4 text-sm font-semibold rounded-t-md transition-colors border-b-2 ${ isActive ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50' } disabled:opacity-50 disabled:cursor-not-allowed`} aria-selected={isActive}>
            {icon} {label}
        </button>
    );

    const renderGenerateStage = () => (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 h-full">
            <div className="lg:col-span-1 flex flex-col gap-6">
                <div>
                    <h3 className="text-xl font-bold mb-2">2. Customize &amp; Publish</h3>
                    <p className="text-slate-600 dark:text-slate-400">Fine-tune the appearance and choose how to add it to your post.</p>
                </div>
                
                <div className="space-y-4">
                     <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">Accent Color</h4>
                    <div className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-700">
                        <input id="theme-color" type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-10 h-10 p-0 border-none bg-transparent rounded cursor-pointer" aria-label="Select accent color" disabled={!generatedSnippet || modalStatus === 'loading'} />
                        <span className="font-mono text-sm text-slate-500">{themeColor}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">Placement Options</h4>
                    <div className="space-y-3">
                         <PlacementOption value="ai" title="AI-Suggested (Recommended)" description="Intelligently places the quiz before the final H2/H3 heading for maximum impact." icon={<SparklesIcon className="w-5 h-5"/>} currentPlacement={placement} setPlacement={setPlacement} />
                         <PlacementOption value="end" title="End of Post" description="Safely appends the quiz to the bottom of the article content." icon={<CodeBracketIcon className="w-5 h-5 -rotate-90"/>} currentPlacement={placement} setPlacement={setPlacement}/>
                         <PlacementOption value="manual" title="Manual Placement" description="Gives you a shortcode to copy and paste anywhere in the WordPress editor." icon={<ClipboardIcon className="w-5 h-5"/>} currentPlacement={placement} setPlacement={setPlacement}/>
                    </div>
                </div>

                <div className="space-y-3 mt-auto">
                     <Button onClick={() => insertSnippet(placement)} disabled={modalStatus === 'loading' || !generatedSnippet} className="w-full" size="large">
                        {isInserting ? <><Spinner /> Publishing...</> : (placement === 'manual' ? 'Create & Get Shortcode' : 'Publish to Post')}
                     </Button>
                     <Button onClick={generateSnippetForModal} className="w-full" variant="secondary" disabled={modalStatus === 'loading'}>Regenerate Quiz</Button>
                </div>
            </div>

            <div className="lg:col-span-2 flex flex-col min-h-[55vh] lg:min-h-0">
                {isGeneratingSnippet ? (
                    <div className="flex-grow bg-slate-100 dark:bg-slate-900/50 rounded-lg p-6 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                        <div className="flex items-center">
                           <Spinner />
                           <h3 className="ml-4 font-semibold text-slate-700 dark:text-slate-200">AI is crafting your quiz...</h3>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This can take a few moments.</p>
                        <div className="w-full max-w-2xl mt-6 p-4 rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                           <div className="bg-slate-900 dark:bg-black/50 rounded-lg shadow-lg overflow-hidden border border-slate-700/50 h-full flex flex-col">
                              <div className="flex-shrink-0 flex justify-between items-center px-4 py-2 bg-slate-800/50 dark:bg-slate-900/50 border-b border-slate-700/50">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-6 w-20" />
                              </div>
                              <div className="p-4 flex-grow space-y-3 animate-pulse">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-5/6" />
                              </div>
                           </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center border-b border-slate-200 dark:border-slate-700">
                        <TabButton label="Code" isActive={activeTab === 'code'} onClick={() => setActiveTab('code')} icon={<CodeBracketIcon className="w-5 h-5"/>} />
                        <TabButton label="Preview" isActive={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<EyeIcon className="w-5 h-5"/>} disabled={isGeneratingSnippet} />
                        </div>
                        <div className="flex-grow bg-slate-100 dark:bg-slate-900/50 rounded-b-lg p-1 border border-t-0 border-slate-200 dark:border-slate-700">
                            {activeTab === 'code' && (<CodeBlock code={generatedSnippet} isStreaming={isGeneratingSnippet} />)}
                            {activeTab === 'preview' && !isGeneratingSnippet && (<iframe key={iframeSrcDoc} srcDoc={iframeSrcDoc} title="Generated Snippet Preview" className="w-full h-full border-0 rounded-md shadow-inner" sandbox="allow-scripts allow-forms"/>)}
                        </div>
                    </>
                )}
            </div>
          </div>
    );

    const renderSuccessStage = () => {
        if (manualShortcode) {
             return (
                 <div className="text-center bg-blue-50 dark:bg-blue-900/50 rounded-xl animate-fade-in flex flex-col items-center justify-center p-8 min-h-[400px]">
                    <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <CheckIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="mt-4 text-2xl font-bold text-blue-800 dark:text-blue-300">Quiz Created!</h3>
                    <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md">
                      Your quiz is ready. Copy the shortcode below and paste it anywhere in your WordPress post editor.
                    </p>
                    <div className="mt-6 w-full max-w-sm mx-auto relative">
                        <input type="text" readOnly value={manualShortcode} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-center p-3 pr-24" />
                        <Button onClick={handleCopyShortcode} className="!absolute right-1 top-1 bottom-1 !rounded-sm !px-3">
                             {shortcodeCopied ? <><CheckIcon className="w-4 h-4 mr-2"/> Copied!</> : <><ClipboardIcon className="w-4 h-4 mr-2"/> Copy</>}
                        </Button>
                    </div>
                    <Button onClick={closeToolGenerationModal} variant="secondary" className="mt-6">Finish & Close</Button>
                </div>
             )
        }
        return (
            <div className="text-center bg-green-50 dark:bg-green-900/50 rounded-xl animate-fade-in flex flex-col items-center justify-center p-8 min-h-[400px]">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <CheckIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="mt-4 text-2xl font-bold text-green-800 dark:text-green-300">Quiz Published Successfully!</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md">
                Your post <a href={activePostForModal.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"  dangerouslySetInnerHTML={{ __html: `"${activePostForModal.title.rendered}"` }}/> has been updated.
                </p>
                <Button onClick={closeToolGenerationModal} className="mt-6">Finish</Button>
            </div>
        );
    }
    
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-fade-in" aria-labelledby="modal-title" role="dialog" aria-modal="true" onClick={closeToolGenerationModal}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-7xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 transform transition-all max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex justify-between items-start mb-4">
                    <div>
                        <h2 id="modal-title" className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100" dangerouslySetInnerHTML={{__html: `Quiz for: "${activePostForModal.title.rendered}"`}}/>
                        {selectedIdea && <p className="text-sm text-slate-500 dark:text-slate-400">Selected Idea: "{selectedIdea.title}"</p>}
                    </div>
                    <button onClick={closeToolGenerationModal} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XCircleIcon className="w-8 h-8"/>
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                    {currentStage === 'ideas' && renderIdeasStage()}
                    {currentStage === 'generate' && renderGenerateStage()}
                    {currentStage === 'success' && renderSuccessStage()}

                    {modalError && (
                        <div className="mt-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm" role="alert">
                            <strong className="font-bold">An Error Occurred: </strong>
                            <span className="block sm:inline">{modalError}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}