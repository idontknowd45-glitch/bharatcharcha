import { useParams, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useGetUserProfileByUsername, useGetPostsByAuthor, useFollowUser, useUnfollowUser, useBlockUser, useUnblockUser } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import PostCard from '../components/PostCard';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, UserPlus, UserMinus, Ban } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { username } = useParams({ from: '/$username' });
  const navigate = useNavigate();
  const { identity } = useInternetIdentity();
  const { data: profile, isLoading: profileLoading } = useGetUserProfileByUsername(username);
  const { data: posts, isLoading: postsLoading } = useGetPostsByAuthor(profile?.principal);
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = identity?.getPrincipal().toString() === profile?.principal.toString();

  const handleFollow = async () => {
    if (!profile) return;
    try {
      if (isFollowing) {
        await unfollowUser.mutateAsync(profile.principal);
        setIsFollowing(false);
        toast.success('Unfollowed user');
      } else {
        await followUser.mutateAsync(profile.principal);
        setIsFollowing(true);
        toast.success('Following user');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update follow status');
    }
  };

  const handleBlock = async () => {
    if (!profile) return;
    try {
      await blockUser.mutateAsync(profile.principal);
      toast.success('User blocked');
      navigate({ to: '/' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to block user');
    }
  };

  if (profileLoading) {
    return (
      <div className="container py-6">
        <p className="text-center text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-6">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">User not found</p>
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

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.profilePicture || '/assets/generated/default-avatar.dim_100x100.png'} />
                <AvatarFallback>{profile.displayName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h1 className="text-2xl font-bold">{profile.displayName}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
                {profile.bio && <p className="mt-2">{profile.bio}</p>}
                {profile.suspended && (
                  <p className="mt-2 text-sm text-destructive font-semibold">This account has been suspended</p>
                )}
              </div>

              {!isOwnProfile && (
                <div className="flex gap-2">
                  <Button onClick={handleFollow} disabled={followUser.isPending || unfollowUser.isPending}>
                    {isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4 mr-2" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={handleBlock} disabled={blockUser.isPending}>
                    <Ban className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-semibold mb-4">Posts</h2>
          {postsLoading ? (
            <p className="text-center text-muted-foreground">Loading posts...</p>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={Number(post.id)} post={post} />
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No posts yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
