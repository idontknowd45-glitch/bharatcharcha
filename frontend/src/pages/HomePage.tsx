import { memo } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetTimeline, useGetCallerUserProfile } from '../hooks/useQueries';
import PostComposer from '../components/PostComposer';
import PostCard from '../components/PostCard';
import TrendingSidebar from '../components/TrendingSidebar';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

function HomePage() {
  const { identity, login, loginStatus } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: timeline, isLoading } = useGetTimeline();

  if (!isAuthenticated) {
    return (
      <div className="container py-12">
        <div className="max-w-2xl mx-auto text-center space-y-6 welcome-screen-animate">
          <img
            src="/assets/generated/platform-logo-transparent.dim_200x200.png"
            alt="BharatCharcha"
            className="h-32 w-32 mx-auto logo-pulse"
          />
          <h1 className="text-4xl font-bold">Welcome to BharatCharcha</h1>
          <p className="text-xl text-muted-foreground">
            Connect with friends, share your thoughts, and discover what's happening around the world.
          </p>
          <Button size="lg" onClick={login} disabled={loginStatus === 'logging-in'} className="button-hover-scale">
            <LogIn className="h-5 w-5 mr-2" />
            {loginStatus === 'logging-in' ? 'Logging in...' : 'Get Started'}
          </Button>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="container py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PostComposer />

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="text-muted-foreground mt-4">Loading timeline...</p>
            </div>
          ) : timeline && timeline.length > 0 ? (
            <div className="space-y-4 timeline-container">
              {timeline.map((post, index) => (
                <div 
                  key={Number(post.id)} 
                  className="post-entry-animate"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 space-y-4 empty-state-animate">
              <img
                src="/assets/generated/empty-timeline.dim_400x300.png"
                alt="Empty timeline"
                className="h-48 mx-auto opacity-50"
              />
              <p className="text-muted-foreground">Your timeline is empty. Follow users to see their posts here!</p>
            </div>
          )}
        </div>

        <div className="hidden lg:block sidebar-card-animate">
          <TrendingSidebar />
        </div>
      </div>
    </div>
  );
}

export default memo(HomePage);
