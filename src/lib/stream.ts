const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const STREAM_RESOLVE_TIMEOUT_MS = 8000;
const STREAM_RESOLVE_RETRY_DELAYS_MS = [0, 700, 1500] as const;

interface StreamResponse {
  error?: string;
  streamUrl?: string | null;
}

export async function resolveStreamUrl(matchUrl: string): Promise<string> {
  let lastError: Error | null = null;

  for (const delay of STREAM_RESOLVE_RETRY_DELAYS_MS) {
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), STREAM_RESOLVE_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/stream?url=${encodeURIComponent(matchUrl)}`,
        { signal: controller.signal }
      );

      const data = (await response.json().catch(() => null)) as StreamResponse | null;

      if (!response.ok) {
        const message = data?.error || 'Failed to fetch stream';
        if (response.status >= 500) {
          lastError = new Error(message);
          continue;
        }
        throw new Error(message);
      }

      if (!data?.streamUrl) {
        throw new Error(data?.error || 'No stream found.');
      }

      return data.streamUrl;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Failed to fetch stream');

      if (lastError.name !== 'AbortError' && delay === STREAM_RESOLVE_RETRY_DELAYS_MS[STREAM_RESOLVE_RETRY_DELAYS_MS.length - 1]) {
        throw lastError;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error(lastError?.name === 'AbortError' ? 'Stream request timed out. Please try again.' : lastError?.message || 'Failed to fetch stream');
}