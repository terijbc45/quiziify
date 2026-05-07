// Server-only helper to fetch fresh news snippets via Firecrawl.
// Used to inject "latest" context into AI quiz generators.

const QUERY_POOL = [
  "latest world news today",
  "trending science discovery this week",
  "biggest sports headline today",
  "latest technology news this week",
  "major entertainment news today",
  "latest space exploration news",
  "recent historical anniversary news",
];

export async function fetchLatestSnippets(topicHint?: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  try {
    const base = topicHint && topicHint !== "any" ? `latest ${topicHint} news this week` : null;
    const q = base ?? QUERY_POOL[Math.floor(Math.random() * QUERY_POOL.length)];
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, limit: 5, tbs: "qdr:w" }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    const items = (json?.data?.web ?? json?.data ?? []).slice(0, 5);
    return items
      .map((i: any) => `- ${i.title ?? ""}: ${i.description ?? i.snippet ?? ""}`)
      .filter((s: string) => s.length > 4)
      .join("\n");
  } catch {
    return "";
  }
}
