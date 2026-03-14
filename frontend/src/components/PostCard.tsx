import { useState, memo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Repeat2, Trash2, Flag } from 'lucide-react';
import { Post } from '../backend';
import { useLikePost, useUnlikePost, useDeletePost, useGetUserProfile } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ReportDialog from './ReportDialog';
import LazyImage from './LazyImage';

interface PostCardProps {
  post: Post;
  showActions?: boolean;
}

function PostCard({ post, showActions = true }: PostCardProps) {
  const { identity } = useInternetIdentity();
  const navigate = useNavigate();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const deletePost = useDeletePost();
  const { data: authorProfile } = useGetUserProfile(post.author);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isAnimatingLike, setIsAnimatingLike] = useState(false);

  const isOwnPost = identity?.getPrincipal().toString() === post.author.toString();
  const timestamp = new Date(Number(post.timestamp) / 1000000);

  const handleLike = useCallback(async () => {
    // Optimistic UI update with animation
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setIsAnimatingLike(true);
    
    setTimeout(() => setIsAnimatingLike(false), 300);

    try {
      if (wasLiked) {
        await unlikePost.mutateAsync(post.id);
      } else {
        await likePost.mutateAsync(post.id);
      }
    } catch (error: any) {
      // Revert on error
      setIsLiked(wasLiked);
      if (error.message.includes('Already liked')) {
        setIsLiked(true);
      } else if (error.message.includes('not liked')) {
        setIsLiked(false);
      } else {
        toast.error(error.message || 'Failed to update like');
      }
    }
  }, [likePost, unlikePost, post.id, isLiked]);

  const handleDelete = useCallback(async () => {
    try {
      await deletePost.mutateAsync(post.id);
      toast.success('Post deleted');
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete post');
    }
  }, [deletePost, post.id]);

  const handleProfileClick = useCallback(() => {
    if (authorProfile?.username) {
      navigate({ to: '/$username', params: { username: authorProfile.username } });
    }
  }, [authorProfile?.username, navigate]);

  const handlePostClick = useCallback(() => {
    navigate({ to: '/post/$postId', params: { postId: post.id.toString() } });
  }, [navigate, post.id]);

  const handleDeleteDialogOpen = useCallback(() => setShowDeleteDialog(true), []);
  const handleReportDialogOpen = useCallback(() => setShowReportDialog(true), []);

  return (
    <>
      <Card className="post-card-animate">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <button onClick={handleProfileClick} className="flex-shrink-0 avatar-hover">
              <Avatar>
                <AvatarImage src={authorProfile?.profilePicture || '/assets/generated/default-avatar.dim_100x100.png'} />
                <AvatarFallback>{authorProfile?.displayName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
            </button>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={handleProfileClick} className="font-semibold hover:underline transition-all">
                  {authorProfile?.displayName || 'Unknown User'}
                </button>
                <span className="text-sm text-muted-foreground">@{authorProfile?.username || 'unknown'}</span>
                <span className="text-sm text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{formatDistanceToNow(timestamp, { addSuffix: true })}</span>
              </div>

              <button onClick={handlePostClick} className="text-left w-full">
                <p className="whitespace-pre-wrap break-words">{post.content}</p>
              </button>

              {post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.hashtags.map((tag, index) => (
                    <button
                      key={index}
                      onClick={() => navigate({ to: '/explore' })}
                      className="text-primary hover:underline transition-all"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              {post.mediaIds.length > 0 && (
                <div className={`grid gap-2 ${post.mediaIds.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.mediaIds.map((url, index) => (
                    <LazyImage 
                      key={index}
                      src={url}
                      alt={`Media ${index + 1}`}
                      className="w-full rounded-md object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>

        {showActions && (
          <CardFooter className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handlePostClick} className="button-hover-scale">
                <MessageCircle className="h-4 w-4 mr-1" />
                {Number(post.replies)}
              </Button>

              <Button variant="ghost" size="sm" className="button-hover-scale">
                <Repeat2 className="h-4 w-4 mr-1" />
                {Number(post.reposts)}
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLike} 
                disabled={likePost.isPending || unlikePost.isPending}
                className="button-hover-scale relative"
              >
                <Heart 
                  className={`h-4 w-4 mr-1 transition-all duration-300 ${
                    isLiked ? 'fill-destructive text-destructive' : ''
                  } ${isAnimatingLike ? 'like-bounce' : ''}`}
                />
                {Number(post.likes)}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {isOwnPost && (
                <Button variant="ghost" size="icon" onClick={handleDeleteDialogOpen} className="button-hover-scale">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
              {!isOwnPost && (
                <Button variant="ghost" size="icon" onClick={handleReportDialogOpen} className="button-hover-scale">
                  <Flag className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardFooter>
        )}
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="dialog-animate">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportDialog postId={post.id} open={showReportDialog} onOpenChange={setShowReportDialog} />
    </>
  );
}

export default memo(PostCard);
