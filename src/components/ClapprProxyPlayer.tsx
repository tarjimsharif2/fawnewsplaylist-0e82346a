import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    Clappr: any;
  }
}

interface ClapprProxyPlayerProps {
  streamUrl: string;
  poster?: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  onStuck?: () => void;
}

const LOGO_URL = 'https://i.ibb.co/Q3rp8ZXs/20260203-180035-0000.png';

export const ClapprProxyPlayer = ({
  streamUrl,
  poster,
  onError,
  onReady,
  onStuck,
}: ClapprProxyPlayerProps) => {
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const logoOriginalParentRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const userPausedRef = useRef(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const logo = logoRef.current;
      if (!logo) return;
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement;
      if (fsElement) {
        logoOriginalParentRef.current = logo.parentElement as HTMLElement;
        fsElement.appendChild(logo);
        logo.style.position = 'absolute';
        logo.style.top = '24px';
        logo.style.right = '24px';
        logo.style.width = window.innerWidth > 768 ? '220px' : '180px';
        logo.style.zIndex = '2147483647';
      } else {
        if (logoOriginalParentRef.current) {
          logoOriginalParentRef.current.appendChild(logo);
        }
        logo.style.position = '';
        logo.style.top = '';
        logo.style.right = '';
        logo.style.width = '';
        logo.style.zIndex = '';
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window.Clappr !== 'undefined') {
      setScriptLoaded(true);
      return;
    }

    const handleLoad = () => setScriptLoaded(true);
    const handleError = () => {
      setError('Failed to load player script.');
      setIsLoading(false);
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-clappr-player="true"]');

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@clappr/player@latest/dist/clappr.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.clapprPlayer = 'true';
      document.head.appendChild(script);
    }

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (typeof window.Clappr !== 'undefined') {
      setScriptLoaded(true);
    }

    return () => {
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
    };
  }, []);

  const applyVideoStretch = useCallback((container: HTMLElement) => {
    const video = container.querySelector('video') as HTMLVideoElement | null;
    if (!video) return;
    video.style.setProperty('object-fit', 'fill', 'important');
    video.style.setProperty('width', '100%', 'important');
    video.style.setProperty('height', '100%', 'important');
    video.style.setProperty('position', 'absolute', 'important');
    video.style.setProperty('inset', '0', 'important');
  }, []);

  const initPlayer = useCallback(() => {
    if (!playerContainerRef.current || typeof window.Clappr === 'undefined') return;

    if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }

    const container = playerContainerRef.current;
    container.innerHTML = '';
    userPausedRef.current = false;
    setError(null);
    setIsLoading(true);
    setIsPaused(false);

    let proxiedSrc = streamUrl;
    if (proxiedSrc.includes('?')) proxiedSrc += `&t=${Date.now()}`;
    else proxiedSrc += `?t=${Date.now()}`;

    try {
      const Clappr = window.Clappr;
      const player = new Clappr.Player({
        source: proxiedSrc,
        parent: container,
        poster,
        autoPlay: true,
        mute: true,
        width: '100%',
        height: '100%',
        mimeType: 'application/x-mpegURL',
        disableVideoTagContextMenu: true,
        playback: {
          playInline: true,
          recycleVideo: true,
          hlsjsConfig: {
            enableWorker: true,
            lowLatencyMode: false,
            debug: false,
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: 6,
            maxLiveSyncPlaybackRate: 1.5,
              maxBufferLength: 20,
              maxMaxBufferLength: 40,
            maxBufferSize: 60 * 1000 * 1000,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetry: 10,
              manifestLoadingRetryDelay: 600,
            manifestLoadingMaxRetry: 10,
              levelLoadingRetryDelay: 600,
            levelLoadingMaxRetry: 10,
            xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = false; },
          },
        },
        events: {
          onReady: () => {
            setIsLoading(false);
            setError(null);
            onReady?.();
            setTimeout(() => applyVideoStretch(container), 100);
            setTimeout(() => applyVideoStretch(container), 500);
            setTimeout(() => { try { player.play(); } catch {} }, 200);
          },
          onPlay: () => {
            setIsLoading(false);
            setError(null);
            setIsPaused(false);
            userPausedRef.current = false;
            applyVideoStretch(container);
          },
          onPause: () => {
            userPausedRef.current = true;
            setIsPaused(true);
          },
          onBuffer: () => setIsLoading(true),
          onBufferFull: () => {
            setIsLoading(false);
            applyVideoStretch(container);
          },
          onError: (err: any) => {
            console.error('ClapprProxy Error:', err);
            const errMsg = 'Playback failed. The stream might be restricted or the proxy is being blocked.';
            setError(errMsg);
            setIsLoading(false);
            setIsPaused(false);
            onError?.(errMsg);
            if (err?.code === 'PLAYBACK_ERROR') setTimeout(() => initPlayer(), 3000);
            onStuck?.();
          },
        },
      });

      playerRef.current = player;

      player.on(Clappr.Events.PLAYER_PLAY, () => {
        setTimeout(() => {
          try {
            player.unmute();
            player.setVolume(100);
          } catch {}
        }, 100);
      });

      const videoWatcher = new MutationObserver(() => {
        const video = container.querySelector('video');
        if (video) {
          video.muted = true;
          video.playsInline = true;
          applyVideoStretch(container);
          videoWatcher.disconnect();
        }
      });
      videoWatcher.observe(container, { childList: true, subtree: true });

    } catch (err) {
      console.error('ClapprProxy init error:', err);
      setError('Could not initialize player.');
      setIsLoading(false);
    }
  }, [streamUrl, poster, onError, onReady, onStuck, applyVideoStretch]);

  useEffect(() => {
    if (scriptLoaded) initPlayer();
    return () => {
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [scriptLoaded, initPlayer]);

  useEffect(() => {
    let lastTime = 0;
    let stuckCount = 0;
    const checkStuck = setInterval(() => {
      const video = playerContainerRef.current?.querySelector('video') as HTMLVideoElement | null;
      if (!video) return;
      if (userPausedRef.current) return;
      if (!video.paused && !isLoading && video.readyState >= 3) {
        if (video.currentTime === lastTime) {
          stuckCount++;
          if (stuckCount >= 20) {
            console.warn('Stream stuck. Reloading...');
            onStuck?.();
            initPlayer();
            stuckCount = 0;
          }
        } else {
          lastTime = video.currentTime;
          stuckCount = 0;
        }
      }
    }, 1000);
    return () => clearInterval(checkStuck);
  }, [initPlayer, isLoading, onStuck]);

  const containerId = useRef(`cp-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div className="relative w-full h-full bg-black">
      <div
        ref={(el) => {
          playerContainerRef.current = el;
          if (el) el.id = containerId;
        }}
        className="w-full h-full"
        style={{ position: 'relative' }}
      />

      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 backdrop-blur-sm z-40">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-sm text-white/70">Connecting to live stream...</p>
        </div>
      )}

      {!error && (
        <img
          ref={logoRef}
          src={LOGO_URL}
          alt="Player logo"
          className="absolute top-4 right-4 w-32 md:w-48 z-50 pointer-events-none opacity-90"
        />
      )}


      {isPaused && !error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <button
            onClick={() => {
              playerRef.current?.play();
              setIsPaused(false);
            }}
            className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center hover:bg-primary transition-colors"
          >
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center p-6 max-w-md">
            <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Transmission Error</h3>
            <p className="text-muted-foreground mb-4 text-sm">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => initPlayer()}
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/80 h-9 px-4"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border text-white hover:bg-card h-9 px-4"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
