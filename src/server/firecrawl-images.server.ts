// Server-only helpers to fetch real images (logos, monuments, places, etc.) via Firecrawl,
// with DB-backed caching. Returns null on failure so call sites can degrade.
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getCached(key: string): Promise<string | null> {
  try {
    const { data } = await admin().from("media_cache").select("url").eq("key", key).maybeSingle();
    return data?.url ?? null;
  } catch { return null; }
}
async function setCached(key: string, url: string) {
  try { await admin().from("media_cache").upsert({ key, url }, { onConflict: "key" }); } catch {}
}

const IMG_EXT = /\.(png|jpe?g|webp|svg)(\?|$)/i;

function pickImageFromSearch(json: any): string | null {
  // Firecrawl v2 search returns { data: { web: [...], images: [...] } } or similar
  const images = json?.data?.images ?? json?.images ?? [];
  for (const it of images) {
    const url: string | undefined = it?.imageUrl ?? it?.url ?? it?.src;
    if (url && /^https?:\/\//.test(url)) return url;
  }
  // Fallback: web results with og image
  const web = json?.data?.web ?? json?.data ?? [];
  for (const it of web) {
    const url: string | undefined = it?.imageUrl ?? it?.metadata?.ogImage ?? it?.thumbnail;
    if (url && /^https?:\/\//.test(url)) return url;
  }
  return null;
}

async function firecrawlImageSearch(query: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 8, sources: ["images", "web"] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return pickImageFromSearch(json);
  } catch { return null; }
}

export async function fetchLogoImage(brand: string, domain?: string): Promise<string | null> {
  const cacheKey = `logo:${brand.toLowerCase()}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  // Try Firecrawl first (real internet images)
  let url = await firecrawlImageSearch(`${brand} company official logo png transparent`);

  // Fallback to Clearbit by domain
  if (!url && domain) {
    const d = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    url = `https://logo.clearbit.com/${d}?size=256`;
  }
  if (!url) return null;
  await setCached(cacheKey, url);
  return url;
}

export async function fetchPlaceImage(subject: string): Promise<string | null> {
  const cacheKey = `place:${subject.toLowerCase()}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;
  const url = await firecrawlImageSearch(`${subject} famous landmark photograph`);
  if (!url) return null;
  await setCached(cacheKey, url);
  return url;
}

export async function fetchFoodAnimalImage(subject: string): Promise<string | null> {
  const cacheKey = `fa:${subject.toLowerCase()}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;
  const url = await firecrawlImageSearch(`${subject} clear photograph`);
  if (!url) return null;
  await setCached(cacheKey, url);
  return url;
}

export async function fetchSubjectImage(subject: string, grade?: string): Promise<string | null> {
  const cacheKey = `subject:${subject.toLowerCase()}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;
  const url = await firecrawlImageSearch(`${subject} school subject textbook cover Nepal ${grade ?? ""}`)
    ?? await firecrawlImageSearch(`${subject} illustration education`);
  if (!url) return null;
  await setCached(cacheKey, url);
  return url;
}

export async function fetchChapterImage(subject: string, chapter: string): Promise<string | null> {
  const cacheKey = `chapter:${subject.toLowerCase()}:${chapter.toLowerCase()}`.slice(0, 180);
  const cached = await getCached(cacheKey);
  if (cached) return cached;
  const url = await firecrawlImageSearch(`${chapter} ${subject} concept illustration`)
    ?? await firecrawlImageSearch(`${chapter} illustration`);
  if (!url) return null;
  await setCached(cacheKey, url);
  return url;
}
