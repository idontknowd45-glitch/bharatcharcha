import { useState } from 'react';
import { useGetTrendingHashtags } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp } from 'lucide-react';

export default function ExplorePage() {
  const { data: trendingHashtags } = useGetTrendingHashtags();
  const [searchQuery, setSearchQuery] = useState('');

  const sortedHashtags = trendingHashtags
    ? [...trendingHashtags].sort((a, b) => Number(b[1]) - Number(a[1]))
    : [];

  const filteredHashtags = searchQuery
    ? sortedHashtags.filter(([tag]) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedHashtags;

  return (
    <div className="container py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Explore</h1>
          <p className="text-muted-foreground">Discover trending topics and hashtags</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search hashtags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending Hashtags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredHashtags.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No hashtags found' : 'No trending hashtags yet'}
              </p>
            ) : (
              <div className="space-y-4">
                {filteredHashtags.map(([tag, count], index) => (
                  <div key={tag} className="flex items-center justify-between p-4 rounded-lg hover:bg-accent transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <p className="text-lg font-semibold">#{tag}</p>
                        <p className="text-sm text-muted-foreground">{Number(count)} posts</p>
                      </div>
                    </div>
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
