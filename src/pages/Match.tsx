import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { ClapprProxyPlayer } from '@/components/ClapprProxyPlayer';
import { resolveStreamUrl } from '@/lib/stream';

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
  const state = (location.state as { matchUrl?: string; streamUrl?: string } | null) ?? null;
  const stateMatchUrl = state?.matchUrl;
  const stateStreamUrl = state?.streamUrl;

  useEffect(() => {
    let active = true;

    const loadStream = async () => {
      setError(null);
      setStreamUrl(null);

      try {
        if (stateStreamUrl) {
          if (active) setStreamUrl(stateStreamUrl);
          return;
        }

        if (stateMatchUrl) {
          const resolvedStream = await resolveStreamUrl(stateMatchUrl);
          if (active) setStreamUrl(resolvedStream);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const srcUrl = params.get('src');
        if (srcUrl) {
          const resolvedStream = await resolveStreamUrl(srcUrl);
          if (active) setStreamUrl(resolvedStream);
          return;
        }

        if (!slug) {
          throw new Error('Match not found.');
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/matches`);
        if (!response.ok) {
          throw new Error('Failed to load match.');
        }

        const data = await response.json();
        const matches = data.matches || [];
        const slugCount: Record<string, number> = {};
        let matchedUrl: string | null = null;

        for (const match of matches) {
          let s = toSlug(match.name);
          if (slugCount[s] !== undefined) {
            slugCount[s]++;
            s = `${s}-${slugCount[s]}`;
          } else {
            slugCount[s] = 0;
          }

          if (s === slug) {
            matchedUrl = match.url;
            break;
          }
        }

        if (!matchedUrl) {
          throw new Error('Match not found.');
        }

        const resolvedStream = await resolveStreamUrl(matchedUrl);
        if (active) setStreamUrl(resolvedStream);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load match.');
        }
      }
    };

    loadStream();

    return () => {
      active = false;
    };
  }, [slug, stateMatchUrl, stateStreamUrl, location.search]);

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
