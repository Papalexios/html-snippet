
import React, { useState } from 'react';
import { WordPressPost, ToolIdea } from '../types';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Skeleton } from './common/Skeleton';
import { DynamicIcon } from './icons/DynamicIcon';
import { useAppContext } from '../context/AppContext';
import { Input } from './common/Input';
import { SearchIcon } from './icons/SearchIcon';
import { CheckIcon } from './icons/CheckIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { WorldIcon } from './icons/FormIcons';
import { Spinner } from './common/Spinner';
import { ConfirmationModal } from './common/ConfirmationModal';


const PostCard: React.FC<{ 
  post: WordPressPost, 
  isSelected: boolean, 
  onSelect: () => void,
  onDeleteRequest: () => void,
  isDeleting: boolean
}> = ({ post, isSelected, onSelect, onDeleteRequest, isDeleting }) => {
  const statusBadge = post.hasOptimizerSnippet ? (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-100 dark:bg-green-900/70 text-green-700 dark:text-green-300 text-xs font-semibold px-2 py-1 rounded-full border border-green-200 dark:border-green-700">
      <CheckIcon className="w-4 h-4" />
      <span>Tool Injected</span>
    </div>
  ) : (
     <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600">
      <LightbulbIcon className="w-4 h-4" />
      <span>No Tool</span>
    </div>
  );

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent post selection
    onDeleteRequest();
  };

  return (
     <button onClick={onSelect} className={`w-full text-left transition-all duration-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/50 ${isSelected ? 'scale-[1.03] shadow-2xl' : 'hover:scale-[1.02]'}`} aria-pressed={isSelected} disabled={isDeleting}>
        <Card className={`h-full flex flex-col relative overflow-hidden transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-500' : ''} ${isDeleting ? 'opacity-60' : ''}`}>
            {statusBadge}
            {isDeleting && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center z-10 rounded-xl">
                    <Spinner/>
                    <span className="ml-2">Deleting...</span>
                </div>
            )}
            <div className="aspect-video bg-slate-100 dark:bg-slate-700 rounded-md mb-4 overflow-hidden">
                {post.featuredImageUrl ? (
                    <img src={post.featuredImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <DynamicIcon name="idea" className="w-12 h-12" />
                    </div>
                )}
            </div>
            <div className="flex-grow">
              <h3 className="font-bold text-slate-800 dark:text-slate-100" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
                <a href={post.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                    <WorldIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{post.link.replace(/^https?:\/\//, '')}</span>
                </a>
                {post.hasOptimizerSnippet && !isDeleting && (
                    <Button
                        onClick={handleDeleteClick}
                        variant="secondary"
                        size="normal"
                        className="!text-sm !py-1.5 !px-3 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 focus:ring-red-500"
                    >
                        Delete Tool
                    </Button>
                )}
            </div>
        </Card>
     </button>
  );
};

const IdeaCard: React.FC<{ idea: ToolIdea, onSelect: () => void }> = ({ idea, onSelect }) => (
  <Card className="flex flex-col justify-between h-full animate-fade-in">
    <div>
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <DynamicIcon name={idea.icon} className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </span>
        <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400">{idea.title}</h3>
      </div>
      <p className="mt-3 text-slate-600 dark:text-slate-300">{idea.description}</p>
    </div>
    <Button onClick={onSelect} className="mt-4 w-full sm:w-auto sm:self-start">
      Select & Generate HTML
    </Button>
  </Card>
);

const loadingMessages = [
    "Analyzing post for key topics...",
    "Brainstorming engaging tool concepts...",
    "Evaluating potential for SEO lift...",
    "Cross-referencing with content strategy...",
    "Finalizing creative ideas..."
];

const SkeletonIdeaCard: React.FC = () => (
    <Card className="space-y-4">
        <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-10 w-40 mt-2" />
    </Card>
);

export default function Step2Analyze(): React.ReactNode {
  const { state, selectPost, selectIdea, setPostSearchQuery, deleteSnippet } = useAppContext();
  const { filteredPosts, selectedPost, status, error, toolIdeas, postSearchQuery, deletingPostId } = state;
  const [loadingMessage, setLoadingMessage] = React.useState(loadingMessages[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<WordPressPost | null>(null);

  React.useEffect(() => {
    if (status === 'loading' && !selectedPost) return; // Ignore initial post loading
    if (status === 'loading' && toolIdeas.length === 0) {
        let messageIndex = 0;
        const intervalId = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            setLoadingMessage(loadingMessages[messageIndex]);
        }, 2500);
        return () => clearInterval(intervalId);
    }
  }, [status, toolIdeas.length, selectedPost]);

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

  const renderIdeasSection = () => {
    if (!selectedPost) {
        return (
             <Card className="flex items-center justify-center h-48 border-dashed text-center">
                <p className="text-slate-500 dark:text-slate-400">Select a post above to generate enhancement ideas.</p>
            </Card>
        );
    }
    if (status === 'loading' && toolIdeas.length === 0) {
        return (
            <div className="text-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <SkeletonIdeaCard/>
                <SkeletonIdeaCard/>
                <SkeletonIdeaCard/>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 animate-pulse">{loadingMessage}</p>
            </div>
        );
    }
     if (error) {
        return (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md" role="alert">
              <strong className="font-bold">Error: </strong>
              <span>{error}</span>
            </div>
        );
     }
     
     return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
             {toolIdeas.map((idea, index) => (
              <IdeaCard key={index} idea={idea} onSelect={() => selectIdea(idea)} />
            ))}
        </div>
     );
  };
  
  return (
    <>
      <div className="animate-fade-in space-y-8 sm:space-y-12">
        <section>
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-800 dark:text-slate-100">1. Select a Post</h2>
          <div className="mb-6">
              <Input 
                  type="search"
                  icon={<SearchIcon className="w-5 h-5" />}
                  placeholder="Search posts by title..."
                  value={postSearchQuery}
                  onChange={(e) => setPostSearchQuery(e.target.value)}
              />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <PostCard 
                    key={post.id} 
                    post={post}
                    isSelected={selectedPost?.id === post.id}
                    onSelect={() => selectPost(post)}
                    onDeleteRequest={() => handleDeleteRequest(post)}
                    isDeleting={deletingPostId === post.id}
                />
              ))
            ) : (
               <div className="text-center py-8 text-slate-500 dark:text-slate-400 md:col-span-2 lg:col-span-3">
                  <p>No posts found for your search query.</p>
               </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-800 dark:text-slate-100">
              2. Choose an Idea
              {selectedPost && <span className="text-lg text-slate-500 dark:text-slate-400 font-normal ml-2" dangerouslySetInnerHTML={{__html: `for "${selectedPost.title.rendered}"`}}/>}
          </h2>
          {renderIdeasSection()}
        </section>
      </div>
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Tool Deletion"
        confirmText="Delete Tool"
        isConfirming={deletingPostId !== null}
      >
        <p>
          Are you sure you want to permanently delete the tool from the post:
          <strong className="block mt-2" dangerouslySetInnerHTML={{ __html: postToDelete?.title.rendered || '' }} />
        </p>
        <p className="mt-2 text-sm text-slate-500">
          This will remove the shortcode from the post and delete the tool's data from WordPress. This action cannot be undone.
        </p>
    </ConfirmationModal>
  </>
  );
}