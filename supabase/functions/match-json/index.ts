const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BASE_URL = "http://www.fawanews.sc/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

interface MatchItem {
  id: string;
  name: string;
  league?: string;
  time?: string;
  image?: string;
  matchUrl: string;
  playerUrl: string;
  streamUrl: string | null;
}

// In-memory cache (per edge instance)
let cache: { ts: number; data: MatchItem[] } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60s

function splitLeagueTime(raw?: string): { league: string; time: string } {
  if (!raw) return { league: "", time: "" };
  const m = raw.match(/^(.*?)(\d{1,2}:\d{2})\s*$/);
  if (m) return { league: m[1].trim(), time: m[2].trim() };
  return { league: raw.trim(), time: "" };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return await res.text();
}

function getProxyBase(): string {
  const projectId = Deno.env
    .get("SUPABASE_URL")
    ?.match(/https:\/\/([^.]+)/)?.[1];
  return projectId
    ? `https://${projectId}.supabase.co/functions/v1/proxy`
    : "";
}

async function resolveStream(matchPath: string): Promise<string | null> {
  try {
    const target = matchPath.startsWith("http")
      ? matchPath
      : BASE_URL + matchPath;
    const html = await fetchText(target);

    let streamUrl: string | null = null;
    const videosMatch = html.match(/var\s+videos\s*=\s*(\[[^\]]+\])/);
    if (videosMatch && videosMatch[1]) {
      try {
        const arr = JSON.parse(videosMatch[1].replace(/'/g, '"'));
        if (arr.length > 0) streamUrl = arr[0];
      } catch {
        const urlMatch = videosMatch[1].match(/["'](http[^"']+\.m3u8)["']/);
        if (urlMatch) streamUrl = urlMatch[1];
      }
    }
    if (!streamUrl) {
      const m = html.match(/(http[^"'\s]+\.m3u8)/);
      if (m) streamUrl = m[1];
    }
    if (streamUrl) {
      const proxyBase = getProxyBase();
      if (proxyBase) {
        return `${proxyBase}?url=${encodeURIComponent(streamUrl)}`;
      }
      return streamUrl;
    }
    return null;
  } catch (e) {
    console.error("resolveStream failed", matchPath, e);
    return null;
  }
}

async function buildMatchList(origin: string): Promise<MatchItem[]> {
  const html = await fetchText(BASE_URL);

  const linkRegex = /<a[^>]*href=["']([^"']+\.html)["'][^>]*>[\s\S]*?<\/a>/gi;
  const seen = new Set<string>();
  const raw: Array<{
    href: string;
    name: string;
    rawTime?: string;
    image?: string;
  }> = [];

  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const block = m[0];
    if (
      href === "index.html" ||
      href === "contact.html" ||
      href === "privacy_policy.html"
    )
      continue;
    if (seen.has(href)) continue;

    const nameMatch = block.match(/class=["']user-item__name["'][^>]*>([^<]+)/);
    if (!nameMatch) continue;
    seen.add(href);

    const timeMatch = block.match(
      /class=["']user-item__playing["'][^>]*>([^<]+)/,
    );
    const imgMatch = block.match(
      /class=["']user-item__avatar["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/,
    );
    raw.push({
      href,
      name: nameMatch[1].trim(),
      rawTime: timeMatch ? timeMatch[1].trim() : undefined,
      image: imgMatch ? imgMatch[1] : undefined,
    });
  }

  // Resolve all streams in parallel (limit concurrency)
  const CONCURRENCY = 8;
  const results: MatchItem[] = [];
  let idx = 0;

  async function worker() {
    while (idx < raw.length) {
      const i = idx++;
      const r = raw[i];
      const { league, time } = splitLeagueTime(r.rawTime);
      const streamUrl = await resolveStream(r.href);
      const playerUrl = `${origin}/match/${toSlug(r.name)}`;
      results[i] = {
        id: r.href,
        name: r.name,
        league,
        time,
        image: r.image,
        matchUrl: r.href.startsWith("http") ? r.href : BASE_URL + r.href,
        playerUrl,
        streamUrl,
      };
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, raw.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const origin =
      url.searchParams.get("origin") ||
      `${url.protocol}//${url.host}`;
    const noCache = url.searchParams.get("nocache") === "1";

    let data: MatchItem[];
    if (!noCache && cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      data = cache.data;
    } else {
      data = await buildMatchList(origin);
      cache = { ts: Date.now(), data };
    }

    const body = JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        count: data.length,
        matches: data,
      },
      null,
      2,
    );

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (e) {
    console.error("match-json error", e);
    return new Response(
      JSON.stringify({ error: "Failed to build match JSON" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});