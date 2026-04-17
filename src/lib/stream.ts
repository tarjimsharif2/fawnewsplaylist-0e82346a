const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface StreamResponse {
  error?: string;
  streamUrl?: string | null;
}

export async function resolveStreamUrl(matchUrl: string): Promise<string> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/stream?url=${encodeURIComponent(matchUrl)}`
  );

  const data = (await response.json().catch(() => null)) as StreamResponse | null;

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to fetch stream');
  }

  if (!data?.streamUrl) {
    throw new Error(data?.error || 'No stream found.');
  }

  return data.streamUrl;
}