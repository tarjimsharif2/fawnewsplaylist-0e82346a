import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ClapprProxyPlayer } from '@/components/ClapprProxyPlayer';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function Match() {
  const { slug } = useParams<{ slug: string }>();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const matchUrl = decodeURIComponent(atob(slug));
    
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
  }, [slug]);

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
    return null; // Clappr handles its own loading
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      <ClapprProxyPlayer streamUrl={streamUrl} />
    </div>
  );
}
