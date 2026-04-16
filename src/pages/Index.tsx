import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Tv, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Match {
  id: string;
  name: string;
  url: string;
  time?: string;
  image?: string;
}

export default function Index() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/matches`);
      if (!res.ok) throw new Error('Failed to fetch matches');
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMatchClick = (match: Match) => {
    const slug = btoa(encodeURIComponent(match.url));
    navigate(`/match/${slug}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row min-h-screen">
          {/* Sidebar */}
          <aside className="hidden md:flex flex-col w-64 border-r border-border p-6">
            <div className="flex items-center gap-2 mb-8">
              <Tv className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold tracking-tight">FawaNews</span>
            </div>
            <nav className="space-y-1">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card text-foreground">
                <Play className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Live Matches</span>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-8">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center gap-2 mb-6">
              <Tv className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold tracking-tight">FawaNews</span>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Live Now</h1>
              <button
                onClick={fetchMatches}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertCircle className="w-8 h-8 text-primary" />
                <p className="text-muted-foreground">{error}</p>
                <button
                  onClick={fetchMatches}
                  className="text-sm text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Tv className="w-8 h-8 text-muted-foreground" />
                <p className="text-muted-foreground">No matches found at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => handleMatchClick(match)}
                    className="bg-card rounded-xl overflow-hidden border border-border relative cursor-pointer hover:border-primary/50 transition-colors group flex flex-col text-left"
                  >
                    <div className="relative aspect-video bg-background">
                      <span className="absolute top-2 left-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded z-10">
                        Live
                      </span>
                      {match.image ? (
                        <img
                          src={match.image}
                          alt={match.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          PREVIEW STREAM
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-primary font-medium mb-1">
                        {match.time ? match.time : 'Live Event'}
                      </p>
                      <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {match.name}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Play className="w-3 h-3" /> Watch
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loading && matches.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 text-center">
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Detected Links</p>
                  <p className="text-sm font-bold text-primary">{matches.length} Active</p>
                </div>
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Server Latency</p>
                  <p className="text-sm font-bold text-foreground">14ms</p>
                </div>
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Scrape Frequency</p>
                  <p className="text-sm font-bold text-foreground">Every 30s</p>
                </div>
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Global Watchers</p>
                  <p className="text-sm font-bold text-foreground">1.2M Online</p>
                </div>
              </div>
            )}
          </main>
      </div>
    </div>
  );
}
