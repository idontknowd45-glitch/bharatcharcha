import { useParams } from '@tanstack/react-router';
import { useGetPost } from '../hooks/useQueries';
import PostCard from '../components/PostCard';
import PostComposer from '../components/PostComposer';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export default function PostDetailPage() {
  const { postId } = useParams({ from: '/post/$postId' });
  const navigate = useNavigate();
  const { data: post, isLoading } = useGetPost(BigInt(postId));

  if (isLoading) {
    return (
      <div className="container py-6">
        <p className="text-center text-muted-foreground">Loading post...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container py-6">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">Post not found</p>
          <Button onClick={() => navigate({ to: '/' })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate({ to: '/' })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <PostCard post={post} />

        <div>
          <h3 className="text-lg font-semibold mb-4">Reply to this post</h3>
          <PostComposer replyToPostId={post.id} placeholder="Write your reply..." />
        </div>
      </div>
    </div>
  );
}
