import { memo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from '@tanstack/react-router';
import { useGetTrendingHashtags } from '../hooks/useQueries';
import { TrendingUp } from 'lucide-react';

function TrendingSidebar() {
  const { data: trendingHashtags } = useGetTrendingHashtags();

  const sortedHashtags = trendingHashtags
    ? [...trendingHashtags].sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 10)
    : [];

  return (
    <Card className="sidebar-card-animate">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trending Hashtags
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedHashtags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trending hashtags yet</p>
        ) : (
          <div className="space-y-3">
            {sortedHashtags.map(([tag, count], index) => (
              <Link 
                key={tag} 
                to="/explore" 
                className="block hover:bg-accent rounded-md p-2 transition-all duration-200 trending-item-hover"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">#{tag}</p>
                    <p className="text-xs text-muted-foreground">{Number(count)} posts</p>
                  </div>
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default memo(TrendingSidebar);
