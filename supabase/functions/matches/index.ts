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
    const response = await fetch(BASE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const html = await response.text();

    const matches: Array<{
      id: string;
      name: string;
      url: string;
      time?: string;
      image?: string;
    }> = [];

    const linkRegex =
      /<a[^>]*href=["']([^"']+\.html)["'][^>]*>[\s\S]*?<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const block = match[0];

      if (
        href === "index.html" ||
        href === "contact.html" ||
        href === "privacy_policy.html"
      )
        continue;

      const nameMatch = block.match(
        /class=["']user-item__name["'][^>]*>([^<]+)/
      );
      if (!nameMatch) continue;

      const name = nameMatch[1].trim();
      if (matches.find((m) => m.url === href)) continue;

      const timeMatch = block.match(
        /class=["']user-item__playing["'][^>]*>([^<]+)/
      );
      const imgMatch = block.match(
        /class=["']user-item__avatar["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/
      );

      matches.push({
        id: href,
        name,
        url: href,
        time: timeMatch ? timeMatch[1].trim() : undefined,
        image: imgMatch ? imgMatch[1] : undefined,
      });
    }

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch matches" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
