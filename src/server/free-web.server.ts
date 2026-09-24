// Free, key-less web access: DuckDuckGo HTML search, direct page fetch,
// Wikipedia/Wikimedia images and Google News RSS. Replaces Firecrawl.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type WebHit = { url: string; title: string; description: string };

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

async function timedFetch(url: string, init: RequestInit = {}, ms = 15000): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, ...(init.headers ?? {}) } });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Free web search via DuckDuckGo's HTML endpoint. */
export async function webSearch(query: string, limit = 10): Promise<WebHit[]> {
  const res = await timedFetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!res?.ok) return [];
  const html = await res.text();
  const hits: WebHit[] = [];
  const blocks = html.split(/class="result results_links/).slice(1);
  for (const b of blocks) {
    const a = b.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let url = a[1]!.replace(/&amp;/g, "&");
    const ud = url.match(/[?&]uddg=([^&]+)/);
    if (ud) url = decodeURIComponent(ud[1]!);
    if (url.startsWith("//")) url = `https:${url}`;
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue;
    const snip = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "";
    hits.push({ url: url.split("#")[0]!, title: decode(a[2]!), description: decode(snip) });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Fetch raw HTML of a page directly. */
export async function fetchHtml(url: string): Promise<string> {
  const res = await timedFetch(url, { headers: { Accept: "text/html,*/*" } }, 20000);
  if (!res?.ok) return "";
  const type = res.headers.get("content-type") ?? "";
  if (type && !/html|text|xml/i.test(type)) return "";
  return (await res.text()).slice(0, 2_000_000);
}

export function htmlToText(html: string): string {
  return decode(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|h\d|tr|br)>/gi, "\n"),
  );
}

/** Search + short page text for grounding prompts. */
export async function webContext(query: string, limit = 5): Promise<string> {
  const hits = await webSearch(query, limit);
  return hits.map((h) => `- ${h.title}: ${h.description}`).join("\n");
}

/** Free image lookup via Wikipedia page images. */
export async function wikiImage(query: string): Promise<string | null> {
  const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=3&gsrsearch=${encodeURIComponent(query)}&prop=pageimages&piprop=original|thumbnail&pithumbsize=800`;
  const res = await timedFetch(api);
  if (!res?.ok) return null;
  try {
    const json = (await res.json()) as { query?: { pages?: Record<string, { index?: number; original?: { source: string }; thumbnail?: { source: string } }> } };
    const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const p of pages) {
      const u = p.thumbnail?.source ?? p.original?.source;
      if (u) return u;
    }
  } catch {}
  return null;
}

/** Latest headlines via Google News RSS (free). */
export async function newsHeadlines(query: string, limit = 5): Promise<string[]> {
  const res = await timedFetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:7d&hl=en&gl=US&ceid=US:en`);
  if (!res?.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
    .map((m) => decode(m[1]!.replace(/<!\[CDATA\[|\]\]>/g, "")))
    .filter(Boolean)
    .slice(0, limit);
}
