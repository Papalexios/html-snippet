import React, { useState, useMemo, useEffect } from 'react';
import { WordPressPost } from '../types';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { useAppContext } from '../context/AppContext';
import { Input } from './common/Input';
import { SearchIcon } from './icons/SearchIcon';
import { CheckIcon } from './icons/CheckIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { WorldIcon } from './icons/FormIcons';
import { Spinner } from './common/Spinner';
import { ConfirmationModal } from './common/ConfirmationModal';
import { SparklesIcon } from './icons/SparklesIcon';
import { Skeleton } from './common/Skeleton';

const getScoreColor = (score?: number) => {
    if (score === undefined || score === null) return 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
    if (score >= 50) return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
};

const Tooltip: React.FC<{ content: string, children: React.ReactNode }> = ({ content, children }) => (
    <div className="relative group flex items-center">
        {children}
        <div className="absolute bottom-full mb-2 w-max max-w-xs bg-slate-800 text-white text-xs rounded-md py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20 shadow-lg dark:bg-slate-900 dark:border dark:border-slate-600">
            {content}
        </div>
    </div>
);

const PostCard: React.FC<{ 
  post: WordPressPost, 
  onDelete: () => void,
  onCreate: () => void,
  onRefresh: () => void,
  isDeleting: boolean,
  isRefreshing: boolean
}> = ({ post, onDelete, onCreate, onRefresh, isDeleting, isRefreshing }) => {
  const isBusy = isDeleting || isRefreshing;

  const handleCreateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCreate();
  };

  const needsRefresh = useMemo(() => {
    if (!post.toolCreationDate) return false;
    const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
    return post.toolCreationDate < sixMonthsAgo;
  }, [post.toolCreationDate]);

  return (
    <Card className={`flex flex-col relative overflow-hidden transition-all duration-300 group ${isBusy ? 'opacity-60' : 'hover:!border-blue-500'}`}>
      {isBusy && (
        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center z-10 rounded-xl">
          <Spinner/>
          <span className="ml-2">{isRefreshing ? 'Refreshing...' : 'Deleting...'}</span>
        </div>
      )}
      <div className="aspect-video bg-slate-100 dark:bg-slate-700 rounded-md mb-4 overflow-hidden relative">
        {post.featuredImageUrl ? (
          <img src={post.featuredImageUrl} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
            <SparklesIcon className="w-12 h-12" />
          </div>
        )}
        {post.opportunityScore !== undefined && post.opportunityScore !== null && (
            <Tooltip content={post.opportunityRationale || 'AI-generated score'}>
                 <div className={`absolute top-2 right-2 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${getScoreColor(post.opportunityScore)}`}>
                    <LightbulbIcon className="w-3 h-3"/>
                    <span>{post.opportunityScore}</span>
                </div>
            </Tooltip>
        )}
      </div>
      <div className="flex-grow">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <a href={post.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
          <WorldIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{post.link.replace(/^https?:\/\//, '')}</span>
        </a>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        {post.hasOptimizerSnippet ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
               <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/70 text-green-700 dark:text-green-300 text-xs font-semibold px-2 py-1 rounded-full">
                  <CheckIcon className="w-4 h-4" />
                  <span>Tool Injected</span>
              </div>
              <Button
                onClick={() => onDelete()}
                variant="secondary"
                size="normal"
                className="!text-xs !py-1 !px-2 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 focus:ring-red-500"
                disabled={isBusy}
              >
                Delete
              </Button>
            </div>
             {needsRefresh && (
                <Button
                    onClick={() => onRefresh()}
                    variant="secondary"
                    className="w-full !text-sm border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 bg-blue-50/50 dark:bg-blue-900/30 hover:bg-blue-100/80 dark:hover:bg-blue-800/50"
                    disabled={isBusy}
                >
                    Refresh Tool
                </Button>
            )}
            {post.toolCreationDate && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-right">
                Created: {new Date(post.toolCreationDate).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <Button onClick={handleCreateClick} className="w-full" disabled={isBusy}>
              <SparklesIcon className="w-5 h-5 mr-2"/>
              Create Tool
          </Button>
        )}
      </div>
    </Card>
  );
};

const PostGridSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
             <Card key={i} className="flex flex-col">
                <Skeleton className="aspect-video w-full mb-4"/>
                <Skeleton className="h-5 w-3/4 mb-2"/>
                <Skeleton className="h-5 w-1/2 mb-4"/>
                <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Skeleton className="h-10 w-full"/>
                </div>
             </Card>
        ))}
    </div>
);


export default function PostDashboard(): React.ReactNode {
  const { state, setPostSearchQuery, setPostSortOrder, deleteSnippet, beginToolCreation, runOpportunityAnalysis, fetchMorePosts, refreshTool } = useAppContext();
  const { status, posts, filteredPosts, postSearchQuery, deletingPostId, refreshingPostId, error, isScoring, postSortOrder, hasMorePosts, isFetchingMorePosts } = state;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<WordPressPost | null>(null);
  const [isAutoCreating, setIsAutoCreating] = useState(false);

  const handleDeleteRequest = (post: WordPressPost) => {
    setPostToDelete(post);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (postToDelete) {
      deleteSnippet(postToDelete.id, postToDelete.toolId).finally(() => {
        setIsModalOpen(false);
        setPostToDelete(null);
      });
    }
  };

  const findBestPostAndOpenModal = (postsToAnalyze: WordPressPost[]) => {
      const bestPost = postsToAnalyze
          .filter(p => !p.hasOptimizerSnippet)
          .sort((a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1))[0];
      
      if (bestPost) {
          beginToolCreation(bestPost);
      } else {
          alert("No suitable posts found for automatic tool creation. All high-opportunity posts may already have tools.");
      }
  };

  useEffect(() => {
      if (!isScoring && isAutoCreating) {
          findBestPostAndOpenModal(posts); // Use the full post list from state after scoring
          setIsAutoCreating(false);
      }
  }, [isScoring, isAutoCreating, posts]);

  const handleAutoCreate = () => {
      setIsAutoCreating(true);
      if (posts.some(p => p.opportunityScore !== undefined)) {
          findBestPostAndOpenModal(posts);
          setIsAutoCreating(false);
      } else {
          runOpportunityAnalysis();
      }
  };


  const renderContent = () => {
    if (status === 'loading' && filteredPosts.length === 0) {
        return <PostGridSkeleton />;
    }
    if (error) {
        return (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md max-w-3xl mx-auto" role="alert">
              <strong className="font-bold">Error: </strong>
              <span>{error}</span>
            </div>
        );
    }
     if (filteredPosts.length === 0 && postSearchQuery) {
        return <p className="text-center py-16 text-slate-500 dark:text-slate-400">No posts found for "{postSearchQuery}"</p>;
    }
    if (filteredPosts.length === 0) {
        return <p className="text-center py-16 text-slate-500 dark:text-slate-400">No published posts found on your WordPress site.</p>;
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredPosts.map((post) => (
                <PostCard 
                    key={post.id} 
                    post={post}
                    onCreate={() => beginToolCreation(post)}
                    onDelete={() => handleDeleteRequest(post)}
                    onRefresh={() => refreshTool(post.id, post.toolId!)}
                    isDeleting={deletingPostId === post.id}
                    isRefreshing={refreshingPostId === post.id}
                />
            ))}
        </div>
        {hasMorePosts && (
          <div className="mt-8 text-center">
            <Button onClick={fetchMorePosts} disabled={isFetchingMorePosts} variant="secondary">
              {isFetchingMorePosts ? <><Spinner/>Loading...</> : 'Load More Posts'}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="animate-fade-in space-y-8">
        <section className="bg-white/60 dark:bg-slate-900/60 rounded-2xl p-4 sm:p-6 border border-white/20 dark:border-slate-700/80 backdrop-blur-2xl">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Opportunity Dashboard</h1>
                    <p className="text-slate-600 dark:text-slate-400">Scan your content to find the best posts for new interactive tools.</p>
                </div>
                <div className="w-full md:w-auto flex flex-col sm:flex-row sm:items-center gap-2 flex-shrink-0">
                    <Button onClick={runOpportunityAnalysis} disabled={isScoring || status === 'loading'}>
                        {isScoring ? <><Spinner/>Scanning...</> : <><LightbulbIcon className="w-5 h-5 mr-2"/>Scan for Opportunities</>}
                    </Button>
                     <Button onClick={handleAutoCreate} disabled={isScoring || status === 'loading' || isAutoCreating}>
                        {isAutoCreating ? <><Spinner/>Working...</> : <>✨ Auto-Create Tool</>}
                    </Button>
                </div>
            </div>

             <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-6">
                 <div className="w-full sm:w-auto sm:max-w-xs">
                    <Input 
                        type="search" icon={<SearchIcon className="w-5 h-5" />} placeholder="Search posts..."
                        value={postSearchQuery} onChange={(e) => setPostSearchQuery(e.target.value)}
                    />
                </div>
                <div>
                     <select 
                        value={postSortOrder} onChange={(e) => setPostSortOrder(e.target.value as 'opportunity' | 'date')}
                        className="rounded-md border-0 py-2 pl-3 pr-8 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all"
                     >
                        <option value="date">Sort by Date</option>
                        <option value="opportunity">Sort by Opportunity</option>
                     </select>
                </div>
            </div>

            {renderContent()}
        </section>
      </div>

      <ConfirmationModal
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={handleConfirmDelete}
        title="Confirm Tool Deletion" confirmText="Delete Tool" isConfirming={deletingPostId !== null}
      >
        <p>
          Are you sure you want to permanently delete the tool from the post:
          <strong className="block mt-2" dangerouslySetInnerHTML={{ __html: postToDelete?.title.rendered || '' }} />
        </p>
        <p className="mt-2 text-sm text-slate-500">This action cannot be undone.</p>
    </ConfirmationModal>
  </>
  );
}