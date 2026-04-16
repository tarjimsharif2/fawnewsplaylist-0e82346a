import { corsHeaders } from "@supabase/supabase-js/cors";

const BASE_URL = "http://www.fawanews.sc/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    // Try var videos = [...] pattern
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

    // Fallback: find any m3u8 URL
    if (!streamUrl) {
      const m3u8Match = html.match(/(http[^"'\s]+\.m3u8)/);
      if (m3u8Match && m3u8Match[1]) {
        streamUrl = m3u8Match[1];
      }
    }

    // Rewrite to proxy through our proxy function
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
