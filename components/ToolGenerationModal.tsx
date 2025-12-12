import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Button } from './common/Button';
import { Card } from './common/Card';
import { Spinner } from './common/Spinner';
import { Skeleton } from './common/Skeleton';
import { DynamicIcon } from './icons/DynamicIcon';
import { ToolIdea, Placement, OptimizationStrategy } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { CodeBlock } from './common/CodeBlock';
import { EyeIcon, CodeBracketIcon } from './icons/ToolIcons';
import { XCircleIcon } from './icons/XCircleIcon';
import { ClipboardIcon } from './icons/ActionIcons';
import { SparklesIcon } from './icons/SparklesIcon';
import { WorldIcon } from './icons/FormIcons';
import { SearchIcon } from './icons/SearchIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ChartIcon } from './icons/ToolIcons';

const loadingMessages = [
    "Analyzing post for key topics...",
    "Brainstorming engaging quiz concepts...",
    "Evaluating potential for SEO lift...",
    "Cross-referencing with content strategy...",
    "Finalizing creative ideas..."
];

const IdeaCard: React.FC<{ idea: ToolIdea, onSelect: () => void, isSelected: boolean }> = ({ idea, onSelect, isSelected }) => (
    <button onClick={onSelect} className={`w-full text-left transition-all duration-300 ease-out rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/50 ${isSelected ? 'shadow-2xl shadow-blue-500/20 scale-105' : 'hover:scale-105'}`}>
        <Card className={`h-full flex flex-col justify-between text-left transition-all group ${isSelected ? '!border-blue-500 ring-2 ring-blue-500' : ''}`}>
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

const StrategyOption: React.FC<{
    value: OptimizationStrategy;
    title: string;
    description: string;
    icon: React.ReactNode;
    currentStrategy: OptimizationStrategy;
    setStrategy: (strategy: OptimizationStrategy) => void;
}> = ({ value, title, description, icon, currentStrategy, setStrategy }) => (
     <label htmlFor={`strategy-${value}`} className={`block p-4 rounded-xl border-2 transition-all cursor-pointer ${currentStrategy === value ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500' : 'bg-white/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'}`}>
        <input type="radio" id={`strategy-${value}`} name="strategy" value={value} checked={currentStrategy === value} onChange={() => setStrategy(value)} className="sr-only" />
        <div className="flex items-center gap-3">
            <span className="flex-shrink-0">{icon}</span>
            <h4 className="font-bold text-slate-900 dark:text-slate-100">{title}</h4>
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{description}</p>
    </label>
);

// New Component: Content Health Scorecard
const ContentHealthCard: React.FC<{ health: import('../types').ContentHealth }> = ({ health }) => (
    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <ChartIcon className="w-4 h-4 text-purple-500" />
                Autonomous Content Analyzer
            </h3>
            <span className={`px-2 py-1 text-xs font-bold rounded-full ${health.score >= 80 ? 'bg-green-100 text-green-800' : health.score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                Health Score: {health.score}/100
            </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">SEO Gap detected:</span>
                <p className="text-slate-800 dark:text-slate-200">{health.seoGap}</p>
            </div>
            <div>
                 <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">Readability:</span>
                 <p className="text-slate-800 dark:text-slate-200">{health.readability}</p>
            </div>
        </div>
        {health.missingTopics.length > 0 && (
             <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                 <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs block mb-1">Topics to add for authority:</span>
                 <div className="flex flex-wrap gap-2">
                     {health.missingTopics.map((topic, i) => (
                         <span key={i} className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs text-slate-600 dark:text-slate-300">{topic}</span>
                     ))}
                 </div>
             </div>
        )}
    </div>
);


export default function ToolGenerationModal() {
    const { state, closeToolGenerationModal, generateIdeasForModal, selectIdea, generateEnhancedQuizForModal, insertSnippet, setThemeColor } = useAppContext();
    const { isToolGenerationModalOpen, activePostForModal, modalStatus, modalError, toolIdeas, contentHealth, selectedIdea, generatedQuizHtml, themeColor, manualShortcode, suggestedContentUpdate } = state;

    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const [iframeSrcDoc, setIframeSrcDoc] = useState('');
    const [placement, setPlacement] = useState<Placement>('ai');
    const [optimizationStrategy, setOptimizationStrategy] = useState<OptimizationStrategy>('standard');
    const [shortcodeCopied, setShortcodeCopied] = useState(false);
    const [contentUpdateCopied, setContentUpdateCopied] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    // Robust State Logic
    const currentStage = useMemo(() => {
        if (modalStatus === 'success') return 'success';
        if (generatedQuizHtml) return 'publish';
        if (modalStatus === 'loading' && selectedIdea) return 'generate'; 
        return 'ideas';
    }, [modalStatus, selectedIdea, generatedQuizHtml]);

    const isGeneratingIdeas = modalStatus === 'loading' && toolIdeas.length === 0;
    const isGeneratingQuiz = currentStage === 'generate';
    const isInserting = modalStatus === 'loading' && !!generatedQuizHtml && !isGeneratingQuiz;

    useEffect(() => {
        if (isToolGenerationModalOpen && !activePostForModal) {
            closeToolGenerationModal();
        } else if (isToolGenerationModalOpen && toolIdeas.length === 0 && modalStatus === 'idle') {
            generateIdeasForModal();
        }
    }, [isToolGenerationModalOpen, activePostForModal, toolIdeas.length, modalStatus, generateIdeasForModal, closeToolGenerationModal]);
    
    useEffect(() => {
        if (isGeneratingIdeas) {
            const intervalId = setInterval(() => {
                setLoadingMessage(prev => loadingMessages[(loadingMessages.indexOf(prev) + 1) % loadingMessages.length]);
            }, 2500);
            return () => clearInterval(intervalId);
        }
    }, [isGeneratingIdeas]);
    
    useEffect(() => {
        if (generatedQuizHtml) {
            setIframeSrcDoc(`<!DOCTYPE html><html class="${state.theme}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="background-color: transparent;">${generatedQuizHtml}</body></html>`);
        }
    }, [generatedQuizHtml, themeColor, state.theme]);

    const generationSteps = useMemo(() => {
        const steps = [
            { text: "Analyzing post content for key topics...", icon: <SparklesIcon className="w-5 h-5 text-purple-500" /> },
            { text: "Brainstorming higher-order questions...", icon: <LightbulbIcon className="w-5 h-5 text-yellow-500" /> },
        ];
        if (optimizationStrategy === 'fact_check') {
            steps.push({ text: "Verifying facts with Google Search...", icon: <SearchIcon className="w-5 h-5 text-blue-500" /> });
        }
        if (optimizationStrategy === 'geo') {
            steps.push({ text: "Grounding with Google Maps data...", icon: <WorldIcon className="w-5 h-5 text-green-500" /> });
        }
        steps.push(
            { text: "Crafting Socratic explanations...", icon: <ClipboardIcon className="w-5 h-5 text-slate-500" /> },
            { text: "Generating content integration suggestions...", icon: <CodeBracketIcon className="w-5 h-5 text-pink-500" /> },
            { text: "Assembling final interactive snippet...", icon: <CheckCircleIcon className="w-5 h-5 text-indigo-500" /> }
        );
        return steps;
    }, [optimizationStrategy]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isGeneratingQuiz) {
            setCurrentStep(0);
            interval = setInterval(() => {
                setCurrentStep(prevStep => {
                    if (prevStep >= generationSteps.length - 1) {
                        clearInterval(interval);
                        return prevStep;
                    }
                    return prevStep + 1;
                });
            }, 3000); 
        }
        return () => clearInterval(interval);
    }, [isGeneratingQuiz, generationSteps.length]);
    
    const handleCopyShortcode = () => {
        if (!manualShortcode) return;
        navigator.clipboard.writeText(manualShortcode);
        setShortcodeCopied(true);
        setTimeout(() => setShortcodeCopied(false), 2500);
    };

    const handleCopyContentUpdate = () => {
        if (!suggestedContentUpdate) return;
        navigator.clipboard.writeText(suggestedContentUpdate);
        setContentUpdateCopied(true);
        setTimeout(() => setContentUpdateCopied(false), 2500);
    };

    const handleCancelGeneration = () => {
        closeToolGenerationModal();
    };

    if (!isToolGenerationModalOpen || !activePostForModal) return null;

    const renderIdeasStage = () => (
        <>
            <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">1. Choose a Quiz Idea</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Select the concept that best fits your post's goal.</p>
            </div>
            
            {contentHealth && <ContentHealthCard health={contentHealth} />}
            
            {isGeneratingIdeas ? (
                 <div className="text-center">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                        <SkeletonIdeaCard/>
                        <SkeletonIdeaCard/>
                        <SkeletonIdeaCard/>
                    </div>
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 animate-pulse">{loadingMessage}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {toolIdeas.map((idea, index) => (
                        <IdeaCard key={index} idea={idea} onSelect={() => selectIdea(idea)} isSelected={selectedIdea?.title === idea.title}/>
                    ))}
                </div>
            )}
            
            {toolIdeas.length > 0 && !isGeneratingIdeas && (
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                     <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">2. Select an Optimization Strategy</h2>
                     <p className="text-slate-600 dark:text-slate-400 mt-1">Supercharge your quiz with advanced AI capabilities.</p>
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-4">
                        <StrategyOption value="standard" title="Standard" description="A high-quality, engaging quiz based directly on your article's content." icon={<SparklesIcon className="w-6 h-6 text-blue-500"/>} currentStrategy={optimizationStrategy} setStrategy={setOptimizationStrategy} />
                        <StrategyOption value="fact_check" title="Fact-Check (AEO)" description="Uses Google Search to verify data and adds source links. Best for timely or data-heavy topics." icon={<SearchIcon className="w-6 h-6 text-green-500"/>} currentStrategy={optimizationStrategy} setStrategy={setOptimizationStrategy} />
                        <StrategyOption value="geo" title="Hyper-Local (GEO)" description="Uses Google Maps to generate location-aware questions and adds source links. For content with local intent." icon={<WorldIcon className="w-6 h-6 text-purple-500"/>} currentStrategy={optimizationStrategy} setStrategy={setOptimizationStrategy} />
                     </div>
                </div>
            )}

            <div className="mt-8 text-center">
                <Button size="large" onClick={() => generateEnhancedQuizForModal(optimizationStrategy)} disabled={!selectedIdea || isGeneratingIdeas}>
                    {modalError ? 'Retry Generation' : 'Generate Quiz'}
                </Button>
            </div>
        </>
    );

    const renderGenerationLoading = () => (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
             <style>{`
                @keyframes pop-in {
                    0% { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-pop-in {
                    animation: pop-in 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                }
            `}</style>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-2xl">
                AI is Crafting Your Quiz...
            </h3>
            <p className="mt-2 mb-8 text-sm text-slate-500 dark:text-slate-400 max-w-md">
                This process checks facts, optimizes for SEO, and generates code. It may take up to 2 minutes.
            </p>
            <div className="w-full max-w-md space-y-4 text-left">
                {generationSteps.map((step, index) => (
                    <div
                        key={index}
                        className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-500 ${
                            index <= currentStep ? 'bg-slate-100 dark:bg-slate-700/50' : ''
                        }`}
                    >
                        <div className="flex-shrink-0">
                            {index < currentStep ? (
                                <CheckCircleIcon className="w-6 h-6 text-green-500 animate-pop-in" />
                            ) : index === currentStep ? (
                                <Spinner />
                            ) : (
                                <div className="w-6 h-6 flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                                </div>
                            )}
                        </div>
                        <div className="flex-grow flex items-center gap-3">
                            {step.icon}
                            <span
                                className={`transition-colors duration-500 ${
                                    index < currentStep
                                        ? 'text-slate-500 dark:text-slate-400 line-through'
                                        : index === currentStep
                                        ? 'font-semibold text-slate-700 dark:text-slate-200'
                                        : 'text-slate-400 dark:text-slate-500'
                                }`}
                            >
                                {step.text}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            
            <button onClick={handleCancelGeneration} className="mt-8 text-sm text-slate-400 hover:text-red-500 transition-colors underline">
                Cancel Generation
            </button>
        </div>
    );
    
    const TabButton: React.FC<{label: string; isActive: boolean; onClick: () => void; icon: React.ReactNode; disabled?: boolean;}> = ({ label, isActive, onClick, icon, disabled }) => (
        <button onClick={onClick} disabled={disabled} className={`flex items-center gap-2 px-3 py-2 sm:px-4 text-sm font-semibold rounded-t-md transition-colors border-b-2 ${ isActive ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50' } disabled:opacity-50 disabled:cursor-not-allowed`} aria-selected={isActive}>
            {icon} {label}
        </button>
    );

    const renderPublishStage = () => (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 h-full">
            <div className="lg:col-span-1 flex flex-col gap-6">
                <div>
                    <h3 className="text-xl font-bold mb-2">3. Customize &amp; Publish</h3>
                    <p className="text-slate-600 dark:text-slate-400">Fine-tune the appearance and choose how to add it to your post.</p>
                </div>
                
                <div className="space-y-4">
                     <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">Accent Color</h4>
                    <div className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-700">
                        <input id="theme-color" type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-10 h-10 p-0 border-none bg-transparent rounded cursor-pointer" aria-label="Select accent color" disabled={!generatedQuizHtml || modalStatus === 'loading'} />
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
                     <Button onClick={() => insertSnippet(placement)} disabled={modalStatus === 'loading' || !generatedQuizHtml} className="w-full" size="large">
                        {isInserting ? <><Spinner /> Publishing...</> : (placement === 'manual' ? 'Create & Get Shortcode' : 'Publish to Post')}
                     </Button>
                     <Button onClick={() => generateEnhancedQuizForModal(optimizationStrategy)} className="w-full" variant="secondary" disabled={modalStatus === 'loading'}>Regenerate Quiz</Button>
                </div>
            </div>

            <div className="lg:col-span-2 flex flex-col min-h-[55vh] lg:min-h-0">
                <div className="flex items-center border-b border-slate-200 dark:border-slate-700">
                <TabButton label="Preview" isActive={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<EyeIcon className="w-5 h-5"/>} />
                <TabButton label="Code" isActive={activeTab === 'code'} onClick={() => setActiveTab('code')} icon={<CodeBracketIcon className="w-5 h-5"/>} />
                </div>
                <div className="flex-grow bg-slate-100 dark:bg-slate-900/50 rounded-b-lg p-1 border border-t-0 border-slate-200 dark:border-slate-700">
                    {activeTab === 'code' && (<CodeBlock code={generatedQuizHtml} />)}
                    {activeTab === 'preview' && (<iframe key={iframeSrcDoc} srcDoc={iframeSrcDoc} title="Generated Snippet Preview" className="w-full h-full border-0 rounded-md shadow-inner bg-white dark:bg-slate-800"/>)}
                </div>
            </div>
          </div>
    );

    const renderSuccessStage = () => (
         <div className="text-center bg-green-50 dark:bg-green-900/50 rounded-xl animate-fade-in flex flex-col items-center justify-center p-8 min-h-[400px]">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="mt-4 text-2xl font-bold text-green-800 dark:text-green-300">
                {manualShortcode ? "Quiz Created!" : "Quiz Published Successfully!"}
            </h3>
            <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md">
                {manualShortcode 
                    ? "Your quiz is ready. Copy the shortcode and suggested content updates below."
                    : <>Your post <a href={activePostForModal.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold" dangerouslySetInnerHTML={{ __html: `"${activePostForModal.title.rendered}"` }}/> has been updated.</>
                }
            </p>

            {manualShortcode && (
                <div className="mt-6 w-full max-w-sm mx-auto relative">
                    <input type="text" readOnly value={manualShortcode} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-center p-3 pr-24" />
                    <Button onClick={handleCopyShortcode} className="!absolute right-1 top-1 bottom-1 !rounded-sm !px-3">
                         {shortcodeCopied ? <><CheckIcon className="w-4 h-4 mr-2"/> Copied!</> : <><ClipboardIcon className="w-4 h-4 mr-2"/> Copy</>}
                    </Button>
                </div>
            )}
            
            {suggestedContentUpdate && (
                 <div className="mt-6 w-full max-w-2xl text-left bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Full-Circle Content Update</h4>
                        <Button onClick={handleCopyContentUpdate} variant="secondary" className="!text-xs !py-1 !px-2">
                             {contentUpdateCopied ? <><CheckIcon className="w-3 h-3 mr-1"/> Copied</> : <><ClipboardIcon className="w-3 h-3 mr-1"/> Copy Text</>}
                        </Button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">Copy and paste these paragraphs into your post for seamless integration.</p>
                    <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-800 p-3 rounded-md">
                        {suggestedContentUpdate}
                    </div>
                </div>
            )}

            <Button onClick={closeToolGenerationModal} className="mt-6">Finish</Button>
        </div>
    );
    
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

                <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-6">
                    {currentStage === 'ideas' && renderIdeasStage()}
                    {currentStage === 'generate' && renderGenerationLoading()}
                    {currentStage === 'publish' && renderPublishStage()}
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