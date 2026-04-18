import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Tv, Loader2, AlertCircle, RefreshCw, Search, MoreHorizontal } from 'lucide-react';
import { resolveStreamUrl } from '@/lib/stream';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Match {
  id: string;
  name: string;
  url: string;
  time?: string;
  image?: string;
}

function splitLeagueTime(raw?: string): { league: string; time: string } {
  if (!raw) return { league: '', time: '' };
  const m = raw.match(/^(.*?)(\d{1,2}:\d{2})\s*$/);
  if (m) return { league: m[1].trim(), time: m[2].trim() };
  return { league: raw.trim(), time: '' };
}

export default function Index() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
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

  const toSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 60);

  const slugMap = useMemo(() => {
    const slugCount: Record<string, number> = {};
    const slugMap: Record<string, string> = {};
    matches.forEach((match) => {
      let slug = toSlug(match.name);
      if (slugCount[slug] !== undefined) {
        slugCount[slug]++;
        slug = `${slug}-${slugCount[slug]}`;
      } else {
        slugCount[slug] = 0;
      }
      slugMap[match.id] = slug;
    });
    return slugMap;
  }, [matches]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.time || '').toLowerCase().includes(q)
    );
  }, [matches, query]);

  const handleMatchClick = useCallback(async (match: Match) => {
    const slug = slugMap[match.id];
    setPendingMatchId(match.id);
    setError(null);

    try {
      const streamUrl = await resolveStreamUrl(match.url);
      navigate(`/match/${slug}`, { state: { matchUrl: match.url, streamUrl } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open stream');
    } finally {
      setPendingMatchId(null);
    }
  }, [navigate, slugMap]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-border p-6">
          <div className="flex items-center gap-2 mb-8">
            <Tv className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">ePlayHD</span>
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
          <div className="md:hidden flex items-center gap-2 mb-4">
            <Tv className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">ePlayHD</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl md:text-2xl font-bold">Live Now</h1>
            <button
              onClick={fetchMatches}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search matches or league..."
              className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Tv className="w-8 h-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {matches.length === 0 ? 'No matches found at the moment.' : 'No matches match your search.'}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {filtered.map((match) => {
                const isPending = pendingMatchId === match.id;
                const { league, time } = splitLeagueTime(match.time);
                return (
                  <li key={match.id}>
                    <button
                      onClick={() => handleMatchClick(match)}
                      disabled={isPending}
                      aria-busy={isPending}
                      className="w-full flex items-center gap-3 bg-card hover:bg-card/70 border border-border hover:border-primary/40 rounded-xl p-3 text-left transition-colors disabled:opacity-70"
                    >
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-background flex items-center justify-center">
                          {match.image ? (
                            <img
                              src={match.image}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Tv className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card"
                          aria-label="Live"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {match.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {league}
                          {time && <span className="ml-1 text-foreground/80">{time}</span>}
                        </p>
                      </div>

                      <div className="shrink-0 text-muted-foreground">
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <MoreHorizontal className="w-5 h-5" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && matches.length > 0 && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Showing {filtered.length} of {matches.length} matches
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
