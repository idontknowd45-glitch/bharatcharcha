import { useState, useCallback, memo, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Image, X, Loader2 } from 'lucide-react';
import { useCreatePost } from '../hooks/useQueries';
import { toast } from 'sonner';

interface PostComposerProps {
  onSuccess?: () => void;
  replyToPostId?: bigint;
  placeholder?: string;
}

function PostComposer({ onSuccess, replyToPostId, placeholder }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const createPost = useCreatePost();

  const MAX_CHARS = 280;
  const remainingChars = MAX_CHARS - content.length;

  const extractHashtags = useCallback((text: string): string[] => {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map((tag) => tag.substring(1)) : [];
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      toast.error('Post content cannot be empty');
      return;
    }

    if (content.length > MAX_CHARS) {
      toast.error(`Post exceeds ${MAX_CHARS} character limit`);
      return;
    }

    const hashtags = extractHashtags(content);

    try {
      await createPost.mutateAsync({
        content: content.trim(),
        hashtags,
        mediaIds,
        originalPostId: replyToPostId || null,
      });
      
      // Use transition for smooth UI update
      startTransition(() => {
        setContent('');
        setMediaIds([]);
        setIsExpanded(false);
      });
      
      toast.success(replyToPostId ? 'Reply posted!' : 'Post created!');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post');
    }
  }, [content, mediaIds, replyToPostId, createPost, extractHashtags, onSuccess]);

  const handleAddMedia = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url && mediaIds.length < 4) {
      setMediaIds([...mediaIds, url]);
    } else if (mediaIds.length >= 4) {
      toast.error('Maximum 4 images allowed');
    }
  }, [mediaIds]);

  const handleRemoveMedia = useCallback((index: number) => {
    setMediaIds(mediaIds.filter((_, i) => i !== index));
  }, [mediaIds]);

  const handleFocus = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleBlur = useCallback(() => {
    if (!content.trim() && mediaIds.length === 0) {
      setIsExpanded(false);
    }
  }, [content, mediaIds]);

  return (
    <Card 
      className={`composer-card-animate transition-all duration-300 ease-out ${
        isExpanded ? 'composer-expanded' : 'composer-collapsed'
      }`}
    >
      <CardContent className="pt-6">
        <div className="space-y-4">
          <Textarea
            placeholder={placeholder || "What's happening?"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            rows={isExpanded ? 4 : 2}
            className={`resize-none input-focus-animate transition-all duration-300 ${
              isExpanded ? 'min-h-[100px]' : 'min-h-[60px]'
            }`}
            disabled={createPost.isPending}
          />

          {mediaIds.length > 0 && (
            <div className="grid grid-cols-2 gap-2 media-grid-animate">
              {mediaIds.map((url, index) => (
                <div key={index} className="relative group media-preview-animate">
                  <img 
                    src={url} 
                    alt={`Media ${index + 1}`} 
                    className="w-full h-32 object-cover rounded-md transition-transform duration-200 hover:scale-105" 
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={() => handleRemoveMedia(index)}
                    disabled={createPost.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div 
            className={`flex items-center justify-between transition-all duration-300 ${
              isExpanded ? 'opacity-100 translate-y-0' : 'opacity-70 translate-y-[-4px]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleAddMedia} 
                disabled={mediaIds.length >= 4 || createPost.isPending}
                className="button-hover-scale"
              >
                <Image className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-medium transition-all duration-200 ${
                  remainingChars < 0 
                    ? 'text-destructive scale-110' 
                    : remainingChars < 20 
                    ? 'text-warning scale-105' 
                    : 'text-muted-foreground scale-100'
                }`}
              >
                {remainingChars}
              </span>
              <Button 
                onClick={handleSubmit} 
                disabled={createPost.isPending || !content.trim() || remainingChars < 0}
                className="button-hover-scale min-w-[100px]"
              >
                {createPost.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  replyToPostId ? 'Reply' : 'Post'
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(PostComposer);
