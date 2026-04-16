import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { ClapprProxyPlayer } from '@/components/ClapprProxyPlayer';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

export default function Match() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Try location.state (from internal navigation — fastest)
    const stateMatchUrl = (location.state as any)?.matchUrl;
    if (stateMatchUrl) {
      fetchStream(stateMatchUrl);
      return;
    }

    // 2. Try ?src= query param (for iframe embed — skips matches lookup)
    const params = new URLSearchParams(window.location.search);
    const srcUrl = params.get('src');
    if (srcUrl) {
      fetchStream(srcUrl);
      return;
    }

    // 3. Fallback: look up match by slug from the matches API
    if (!slug) { setError('Match not found.'); return; }

    fetch(`${SUPABASE_URL}/functions/v1/matches`)
      .then(res => res.json())
      .then(data => {
        const matches = data.matches || [];
        const slugCount: Record<string, number> = {};
        for (const match of matches) {
          let s = toSlug(match.name);
          if (slugCount[s] !== undefined) {
            slugCount[s]++;
            s = `${s}-${slugCount[s]}`;
          } else {
            slugCount[s] = 0;
          }
          if (s === slug) {
            fetchStream(match.url);
            return;
          }
        }
        setError('Match not found.');
      })
      .catch(() => setError('Failed to load match.'));
  }, [slug]);

  const fetchStream = (matchUrl: string) => {
    fetch(`${SUPABASE_URL}/functions/v1/stream?url=${encodeURIComponent(matchUrl)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch stream');
        return res.json();
      })
      .then(data => {
        if (data.streamUrl) setStreamUrl(data.streamUrl);
        else setError('No stream found.');
      })
      .catch(err => setError(err.message));
  };

  // Auto landscape on fullscreen for mobile
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch {}
    };

    const handleFullscreen = () => {
      if (document.fullscreenElement) {
        lockLandscape();
      } else {
        try { screen.orientation?.unlock?.(); } catch {}
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('webkitfullscreenchange', handleFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('webkitfullscreenchange', handleFullscreen);
    };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <p>{error}</p>
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-sm text-white/60">Please wait, stream is loading...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      <ClapprProxyPlayer streamUrl={streamUrl} />
    </div>
  );
}
