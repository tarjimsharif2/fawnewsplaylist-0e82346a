const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_REFERERS = [
  "eplayhd.com",
  "cricfoots.com",
  "photocard.fun",
  "id-preview--d7474244-904c-47a7-bfbf-66d59ba09980.lovable.app",
  "lovable.app",
  "lovableproject.com",
  "localhost",
];

function checkReferer(req: Request): Response | null {
  if (req.method === "OPTIONS") return null;
  const referer = req.headers.get("referer") || req.headers.get("origin") || "";
  if (!referer) {
    return new Response(
      JSON.stringify({ error: "Access denied. No referer." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  try {
    const host = new URL(referer).hostname;
    const allowed = ALLOWED_REFERERS.some(
      (d) => host === d || host.endsWith("." + d)
    );
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Access denied. Unauthorized domain." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Access denied. Invalid referer." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return null;
}

const BASE_URL = "http://www.fawanews.sc/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const blocked = checkReferer(req);
  if (blocked) return blocked;

  try {
    const urlObj = new URL(req.url);
    const url = urlObj.searchParams.get("url");

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = url.startsWith("http") ? url : BASE_URL + url;
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const html = await response.text();

    let streamUrl: string | null = null;

    const videosMatch = html.match(/var\s+videos\s*=\s*(\[[^\]]+\])/);
    if (videosMatch && videosMatch[1]) {
      try {
        const videosArray = JSON.parse(videosMatch[1].replace(/'/g, '"'));
        if (videosArray.length > 0) {
          streamUrl = videosArray[0];
        }
      } catch {
        const urlMatch = videosMatch[1].match(/["'](http[^"']+\.m3u8)["']/);
        if (urlMatch && urlMatch[1]) {
          streamUrl = urlMatch[1];
        }
      }
    }

    if (!streamUrl) {
      const m3u8Match = html.match(/(http[^"'\s]+\.m3u8)/);
      if (m3u8Match && m3u8Match[1]) {
        streamUrl = m3u8Match[1];
      }
    }

    if (streamUrl) {
      const projectId = Deno.env.get("SUPABASE_URL")?.match(
        /https:\/\/([^.]+)/
      )?.[1];
      if (projectId) {
        streamUrl = `https://${projectId}.supabase.co/functions/v1/proxy?url=${encodeURIComponent(
          streamUrl
        )}`;
      }
    }

    return new Response(JSON.stringify({ streamUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching stream:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch stream URL" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
