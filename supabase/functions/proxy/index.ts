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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const blocked = checkReferer(req);
  if (blocked) return blocked;

  const urlObj = new URL(req.url);
  const url = urlObj.searchParams.get("url");

  if (!url || typeof url !== "string") {
    return new Response("URL is required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Referer: "http://www.fawanews.sc/",
        Origin: "http://www.fawanews.sc",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    if (url.includes(".m3u8") || contentType.includes("mpegurl")) {
      let text = await response.text();

      const baseUrl = new URL(url);
      const projectId = Deno.env.get("SUPABASE_URL")?.match(
        /https:\/\/([^.]+)/
      )?.[1];
      const proxyBase = projectId
        ? `https://${projectId}.supabase.co/functions/v1/proxy`
        : "";

      const lines = text.split("\n");
      const rewrittenLines = lines.map((line) => {
        line = line.trim();
        if (line && !line.startsWith("#")) {
          let absoluteUrl = line;
          if (!line.startsWith("http")) {
            if (line.startsWith("/")) {
              absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${line}`;
            } else {
              const basePath = baseUrl.pathname.substring(
                0,
                baseUrl.pathname.lastIndexOf("/") + 1
              );
              absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${basePath}${line}`;
            }
          }
          return `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}`;
        }
        if (line.startsWith("#EXT-X-KEY") && line.includes('URI="')) {
          return line.replace(
            /URI="([^"]+)"/,
            (_match: string, uri: string) => {
              let absoluteUrl = uri;
              if (!uri.startsWith("http")) {
                if (uri.startsWith("/")) {
                  absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${uri}`;
                } else {
                  const basePath = baseUrl.pathname.substring(
                    0,
                    baseUrl.pathname.lastIndexOf("/") + 1
                  );
                  absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${basePath}${uri}`;
                }
              }
              return `URI="${proxyBase}?url=${encodeURIComponent(absoluteUrl)}"`;
            }
          );
        }
        return line;
      });

      return new Response(rewrittenLines.join("\n"), {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType || "application/vnd.apple.mpegurl",
        },
      });
    } else {
      const data = await response.arrayBuffer();
      return new Response(data, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType || "application/octet-stream",
        },
      });
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Proxy error for URL:", url, errMsg);
    return new Response("Proxy error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
