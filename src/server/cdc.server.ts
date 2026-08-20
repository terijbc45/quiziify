// Server-only helpers that fetch REAL curriculum data from Nepal's
// Curriculum Development Centre (moecdc.gov.np) using Firecrawl + PDF parsing.
//
// Pipeline:
//   1. Firecrawl `map` the CDC site to discover the official textbook /
//      curriculum content page for a given grade + subject.
//   2. Scrape that page's raw HTML and pull the embedded official PDF URL
//      (CDC serves books through a flipbook viewer, so the PDF link only
//      exists in the markup).
//   3. Download the PDF and extract the first pages of text — that is where
//      the real "Table of Contents" / unit list lives.

const FIRECRAWL = "https://api.firecrawl.dev/v2";
const CDC_HOSTS = ["moecdc.gov.np", "cdc.gov.np"];

const NE_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
export function toNepaliNumber(n: string | number): string {
  return String(n).replace(/\d/g, (d) => NE_DIGITS[Number(d)]);
}

/** Nepali aliases for common CDC subject names, used to score page titles. */
const SUBJECT_ALIASES: Record<string, string[]> = {
  nepali: ["नेपाली"],
  english: ["अंग्रेजी", "अङ्ग्रेजी"],
  mathematics: ["गणित"],
  "compulsory mathematics": ["गणित"],
  "optional mathematics": ["ऐच्छिक गणित"],
  science: ["विज्ञान"],
  "science and technology": ["विज्ञान तथा प्रविधि", "विज्ञान"],
  "social studies": ["सामाजिक अध्ययन", "समाजिक"],
  "health population and environment": ["स्वास्थ्य", "जनसंख्या"],
  computer: ["कम्प्युटर"],
  "computer science": ["कम्प्युटर"],
  accountancy: ["लेखा"],
  economics: ["अर्थशास्त्र"],
  sanskrit: ["संस्कृत"],
  "moral education": ["नैतिक शिक्षा"],
  physics: ["भौतिक"],
  chemistry: ["रसायन"],
  biology: ["जीव"],
  "business studies": ["व्यवसाय"],
};

function gradeTokens(grade: string): string[] {
  const num = (grade.match(/\d+/) ?? [])[0];
  if (!num) return [grade.toLowerCase()];
  return [num, toNepaliNumber(num)];
}

function subjectTokens(subject: string): string[] {
  const s = subject.toLowerCase().trim();
  const extra = SUBJECT_ALIASES[s] ?? [];
  const words = s.split(/[^a-z]+/).filter((w) => w.length > 3);
  const aliasHits = Object.entries(SUBJECT_ALIASES)
    .filter(([k]) => s.includes(k) || k.includes(s))
    .flatMap(([, v]) => v);
  return [s, ...words, ...extra, ...aliasHits];
}

type MapLink = { url: string; title?: string; description?: string };

async function firecrawlMap(host: string, search: string, limit = 30): Promise<MapLink[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${FIRECRAWL}/map`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: `https://${host}`, search, limit }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const links = json?.links ?? json?.data?.links ?? [];
    return (Array.isArray(links) ? links : [])
      .map((l: unknown) => (typeof l === "string" ? { url: l } : (l as MapLink)))
      .filter((l: MapLink) => !!l?.url);
  } catch {
    return [];
  }
}

async function firecrawlRawHtml(url: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch(`${FIRECRAWL}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false, timeout: 30000 }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    return json?.rawHtml ?? json?.data?.rawHtml ?? "";
  } catch {
    return "";
  }
}

/** Discover CDC pages relevant to a grade (+ optional subject). */
export async function discoverCdcPages(grade: string, subject?: string): Promise<MapLink[]> {
  const gTokens = gradeTokens(grade);
  const query = subject
    ? `${subject} कक्षा ${gTokens[1] ?? ""} class ${gTokens[0] ?? ""} textbook curriculum`
    : `कक्षा ${gTokens[1] ?? ""} class ${gTokens[0] ?? ""} textbook पाठ्यपुस्तक curriculum पाठ्यक्रम`;

  const results = await Promise.all(CDC_HOSTS.map((h) => firecrawlMap(h, query, 40)));
  const seen = new Set<string>();
  const links: MapLink[] = [];
  for (const l of results.flat()) {
    const u = l.url.split("#")[0];
    if (seen.has(u)) continue;
    seen.add(u);
    links.push({ ...l, url: u });
  }
  return links;
}

function scorePage(link: MapLink, grade: string, subject: string): number {
  const hay = `${link.title ?? ""} ${link.description ?? ""} ${link.url}`.toLowerCase();
  let score = 0;
  if (/\/content\//.test(link.url)) score += 3;
  for (const t of gradeTokens(grade)) {
    // Match the grade token as a standalone number to avoid 1 matching 10/12.
    const re = new RegExp(`(^|[^0-9०-९])${t}([^0-9०-९]|$)`);
    if (re.test(hay)) score += 4;
  }
  for (const t of subjectTokens(subject)) {
    if (t && hay.includes(t)) score += 3;
  }
  if (/curriculum|पाठ्यक्रम|textbook|पाठ्यपुस्तक/.test(hay)) score += 1;
  return score;
}

function pdfUrlsFromHtml(html: string): string[] {
  const matches = [...html.matchAll(/https?:\/\/[^"'\s<>()]+\.pdf/gi)].map((m) => m[0]);
  return [...new Set(matches)];
}

/** Extract text from the first pages of a PDF (where the Table of Contents lives). */
export async function pdfFrontMatter(pdfUrl: string, maxPages = 14): Promise<string> {
  try {
    const res = await fetch(pdfUrl);
    if (!res.ok) return "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const pages = Math.min(pdf.numPages, maxPages);
    const out: string[] = [];
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it: unknown) => (it as { str?: string }).str ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) out.push(text);
      if (out.join(" ").length > 14000) break;
    }
    if (out.length === 0) {
      const { text } = await extractText(pdf, { mergePages: true });
      return String(text).slice(0, 14000);
    }
    return out.join("\n").slice(0, 14000);
  } catch {
    return "";
  }
}

export type CdcSource = {
  pageUrl: string | null;
  pageTitle: string | null;
  pdfUrl: string | null;
  toc: string;
};

/**
 * Find the official CDC textbook for grade + subject and return the real
 * Table of Contents text extracted from that PDF.
 */
export async function fetchCdcTextbookSource(grade: string, subject: string): Promise<CdcSource> {
  const links = await discoverCdcPages(grade, subject);
  const ranked = links
    .map((l) => ({ l, s: scorePage(l, grade, subject) }))
    .sort((a, b) => b.s - a.s)
    .filter((x) => x.s >= 7)
    .slice(0, 3);

  for (const { l } of ranked) {
    const html = await firecrawlRawHtml(l.url);
    if (!html) continue;
    const pdfs = pdfUrlsFromHtml(html);
    for (const pdf of pdfs.slice(0, 2)) {
      const toc = await pdfFrontMatter(pdf);
      if (toc.length > 400) {
        return { pageUrl: l.url, pageTitle: l.title ?? null, pdfUrl: pdf, toc };
      }
    }
  }
  return { pageUrl: ranked[0]?.l.url ?? null, pageTitle: ranked[0]?.l.title ?? null, pdfUrl: null, toc: "" };
}

/** Titles of CDC textbook/curriculum pages for a grade — real subject evidence. */
export async function fetchCdcSubjectEvidence(grade: string): Promise<{ titles: string[]; urls: string[] }> {
  const links = await discoverCdcPages(grade);
  const g = gradeTokens(grade);
  const keep = links.filter((l) => {
    const hay = `${l.title ?? ""} ${l.url}`.toLowerCase();
    return g.some((t) => new RegExp(`(^|[^0-9०-९])${t}([^0-9०-९]|$)`).test(hay));
  });
  return {
    titles: [...new Set(keep.map((l) => (l.title ?? "").trim()).filter(Boolean))].slice(0, 40),
    urls: keep.map((l) => l.url).slice(0, 40),
  };
}
