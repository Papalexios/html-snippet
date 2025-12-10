import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchQuizAnalytics } from '../services/wordpressService';
import { Status, QuizAnalyticsData } from '../types';
import { Spinner } from './common/Spinner';
import { XCircleIcon } from './icons/XCircleIcon';
import { ChartIcon } from './icons/ToolIcons';
import { Skeleton } from './common/Skeleton';

const StatCard: React.FC<{ title: string; value: string | number; isLoading: boolean }> = ({ title, value, isLoading }) => (
  <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg text-center">
    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</dt>
    {isLoading ? (
      <Skeleton className="h-8 w-16 mx-auto mt-1" />
    ) : (
      <dd className="mt-1 text-3xl font-extrabold text-blue-600 dark:text-blue-400">{value}</dd>
    )}
  </div>
);

const AnalyticsSkeleton: React.FC = () => (
    <>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Total Completions" value={0} isLoading={true} />
            <StatCard title="Average Score" value={0} isLoading={true} />
        </dl>
        <div className="mt-6">
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">Results Breakdown</h4>
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-5 w-24" />
                        <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-full h-5">
                            <Skeleton className="h-5 rounded-full w-1/2" />
                        </div>
                        <Skeleton className="h-5 w-12" />
                    </div>
                ))}
            </div>
        </div>
    </>
);


export default function QuizAnalyticsModal() {
    const { state, closeAnalyticsModal } = useAppContext();
    const { isAnalyticsModalOpen, activeToolIdForAnalytics, wpConfig } = state;

    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<QuizAnalyticsData | null>(null);

    useEffect(() => {
        const getAnalytics = async () => {
            if (isAnalyticsModalOpen && activeToolIdForAnalytics && wpConfig) {
                setStatus('loading');
                setError(null);
                setData(null);
                try {
                    const analyticsData = await fetchQuizAnalytics(wpConfig, activeToolIdForAnalytics);
                    setData(analyticsData);
                    setStatus('success');
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to fetch analytics data.');
                    setStatus('error');
                }
            }
        };
        getAnalytics();
    }, [isAnalyticsModalOpen, activeToolIdForAnalytics, wpConfig]);

    if (!isAnalyticsModalOpen) return null;

    const totalCompletions = data?.completions || 0;

    const renderContent = () => {
        if (status === 'loading') {
            return <AnalyticsSkeleton />;
        }

        if (status === 'error') {
            return (
                <div className="text-center p-8 bg-red-50 dark:bg-red-900/30 rounded-lg">
                    <h4 className="font-bold text-red-700 dark:text-red-300">Could not load analytics</h4>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
                </div>
            );
        }
        
        if (status === 'success' && data) {
            if (totalCompletions === 0) {
                return (
                    <div className="text-center py-10">
                        <ChartIcon className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500" />
                        <h4 className="mt-4 font-semibold text-slate-800 dark:text-slate-200">No Data Yet</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Once readers start completing your quiz, the results will appear here.</p>
                    </div>
                );
            }

            return (
                <>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StatCard title="Total Completions" value={data.completions} isLoading={false} />
                        <StatCard title="Average Score" value={`${data.averageScore}%`} isLoading={false} />
                    </dl>
                    <div className="mt-6">
                        <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">Results Breakdown</h4>
                        <div className="space-y-3">
                            {Object.entries(data.resultCounts)
                                .sort(([, a], [, b]) => (b as number) - (a as number)) // Sort by count descending
                                .map(([title, count]) => {
                                const numericCount = Number(count);
                                const percentage = totalCompletions > 0 ? (numericCount / totalCompletions) * 100 : 0;
                                return (
                                    <div key={title} className="flex items-center gap-4 text-sm">
                                        <div className="w-24 font-medium text-slate-600 dark:text-slate-300 truncate" title={title}>{title}</div>
                                        <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-full h-5 overflow-hidden">
                                            <div 
                                                className="bg-blue-500 h-5 rounded-full"
                                                style={{ width: `${percentage}%` }}
                                                role="progressbar"
                                                aria-valuenow={percentage}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-label={`${title} percentage`}
                                            ></div>
                                        </div>
                                        <div className="w-16 text-right font-semibold text-slate-800 dark:text-slate-200">{numericCount} <span className="text-xs text-slate-500">({Math.round(percentage)}%)</span></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            );
        }
        return null;
    };


    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" aria-labelledby="analytics-modal-title" role="dialog" aria-modal="true" onClick={closeAnalyticsModal}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex justify-between items-center p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 id="analytics-modal-title" className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                        <ChartIcon className="w-6 h-6 text-blue-500" />
                        Quiz Analytics
                    </h2>
                    <button onClick={closeAnalyticsModal} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" aria-label="Close analytics modal">
                        <XCircleIcon className="w-8 h-8"/>
                    </button>
                </header>
                <div className="p-4 sm:p-6 flex-grow overflow-y-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
