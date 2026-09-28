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

const ENGINE_HOSTS = /(brave\.com|bravesoftware|duckduckgo\.com|bing\.com|google\.com|imgs\.search)/i;

/** Brave Search HTML (free, no key) — backup when DuckDuckGo rate-limits. */
async function braveSearch(query: string, limit: number): Promise<WebHit[]> {
  const res = await timedFetch(`https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`);
  if (!res?.ok) return [];
  const html = await res.text();
  const seen = new Set<string>();
  const hits: WebHit[] = [];
  for (const m of html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const url = m[1]!.replace(/&amp;/g, "&").split("#")[0]!;
    if (ENGINE_HOSTS.test(new URL(url).hostname) || seen.has(url)) continue;
    const title = decode(m[2]!);
    if (title.length < 3) continue;
    seen.add(url);
    hits.push({ url, title, description: "" });
    if (hits.length >= limit) break;
  }
  return hits;
}

// ---------- Firecrawl (primary internet access) ----------
const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";
let firecrawlBlockedUntil = 0; // skip Firecrawl briefly after a credit / auth failure

async function firecrawl<T = any>(path: string, body: unknown, ms = 45000): Promise<T | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key || Date.now() < firecrawlBlockedUntil) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(`${FIRECRAWL_V2}${path}`, {
      method: "POST",
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`Firecrawl ${path} failed [${res.status}]: ${txt.slice(0, 200)}`);
      if (res.status === 401 || res.status === 402 || res.status === 403) firecrawlBlockedUntil = Date.now() + 10 * 60_000;
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function firecrawlSearch(query: string, limit: number, tbs?: string): Promise<WebHit[]> {
  const json = await firecrawl<any>("/search", { query, limit, ...(tbs ? { tbs } : {}) });
  const web = json?.data?.web ?? json?.data ?? [];
  if (!Array.isArray(web)) return [];
  return web
    .filter((h: any) => h?.url)
    .map((h: any) => ({ url: String(h.url), title: String(h.title ?? ""), description: String(h.description ?? "") }))
    .slice(0, limit);
}

/** Firecrawl scrape → markdown. Handles PDFs (incl. scanned books via OCR). */
export async function firecrawlMarkdown(url: string): Promise<string> {
  const json = await firecrawl<any>("/scrape", { url, formats: ["markdown"], onlyMainContent: false }, 90000);
  return String(json?.data?.markdown ?? json?.markdown ?? "");
}

/** Firecrawl image search. */
export async function firecrawlImage(query: string): Promise<string | null> {
  const json = await firecrawl<any>("/search", { query, limit: 3, sources: [{ type: "images" }] });
  const imgs = json?.data?.images ?? [];
  for (const it of imgs) {
    const u = it?.imageUrl ?? it?.url;
    if (u && /^https?:\/\//.test(u)) return u;
  }
  return null;
}

/** Web search: Firecrawl first, then free DuckDuckGo / Brave as a safety net. */
export async function webSearch(query: string, limit = 10): Promise<WebHit[]> {
  const fc = await firecrawlSearch(query, limit);
  if (fc.length) return fc;
  const ddg = await ddgSearch(query, limit);
  if (ddg.length) return ddg;
  return braveSearch(query, limit).catch(() => []);
}

async function ddgSearch(query: string, limit: number): Promise<WebHit[]> {
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
  const fc = await firecrawlImage(query);
  if (fc) return fc;
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
  const fc = await firecrawlSearch(`${query} latest news`, limit, "qdr:w");
  if (fc.length) return fc.map((h) => h.title).filter(Boolean);
  const res = await timedFetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:7d&hl=en&gl=US&ceid=US:en`);
  if (!res?.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
    .map((m) => decode(m[1]!.replace(/<!\[CDATA\[|\]\]>/g, "")))
    .filter(Boolean)
    .slice(0, limit);
}
