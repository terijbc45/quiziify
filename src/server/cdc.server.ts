// Server-only helpers that fetch REAL curriculum data from Nepal's
// Curriculum Development Centre (moecdc.gov.np) using Firecrawl + PDF parsing.
//
// Pipeline:
//   1. Firecrawl `map` the CDC site (Nepali + English tokens) to discover the
//      official textbook page for a grade + subject.
//   2. HARD-GATE the candidates: the page must match the grade AND the subject,
//      and must not be a specification grid / model question / notice.
//   3. Scrape the page's raw HTML and pull the embedded official PDF URL
//      (CDC serves books through a flipbook viewer, so the PDF link only
//      exists in the markup).
//   4. Download the PDF, extract the front matter, and verify it really is the
//      book's table of contents before trusting it.

const FIRECRAWL = "https://api.firecrawl.dev/v2";

const NE_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
export function toNepaliNumber(n: string | number): string {
  return String(n).replace(/\d/g, (d) => NE_DIGITS[Number(d)]!);
}
const ROMAN: Record<string, string> = {
  "1": "i", "2": "ii", "3": "iii", "4": "iv", "5": "v", "6": "vi",
  "7": "vii", "8": "viii", "9": "ix", "10": "x", "11": "xi", "12": "xii",
};

/** Nepali + English aliases for CDC subject names. */
const SUBJECT_ALIASES: Record<string, string[]> = {
  nepali: ["नेपाली", "nepali"],
  english: ["अंग्रेजी", "अङ्ग्रेजी", "english"],
  mathematics: ["गणित", "mathematics", "maths"],
  "compulsory mathematics": ["गणित", "mathematics"],
  "optional mathematics": ["ऐच्छिक गणित", "optional mathematics", "additional mathematics"],
  science: ["विज्ञान", "science"],
  "science and technology": ["विज्ञान तथा प्रविधि", "विज्ञान", "science and technology", "science"],
  "social studies": ["सामाजिक अध्ययन", "सामाजिक", "social studies"],
  "health population and environment": ["स्वास्थ्य", "जनसंख्या", "health", "population"],
  computer: ["कम्प्युटर", "computer"],
  "computer science": ["कम्प्युटर विज्ञान", "कम्प्युटर", "computer science"],
  accountancy: ["लेखा", "accountancy", "account"],
  economics: ["अर्थशास्त्र", "economics"],
  sanskrit: ["संस्कृत", "sanskrit"],
  "moral education": ["नैतिक शिक्षा", "moral"],
  physics: ["भौतिक", "physics"],
  chemistry: ["रसायन", "chemistry"],
  biology: ["जीव", "biology"],
  "business studies": ["व्यवसाय", "business studies"],
  "hotel management": ["होटल", "hotel management"],
  sociology: ["समाजशास्त्र", "sociology"],
  psychology: ["मनोविज्ञान", "psychology"],
  "political science": ["राजनीति", "political science"],
  geography: ["भूगोल", "geography"],
};

/** Docs that are NOT textbooks — never use these as a chapter source. */
const REJECT_DOC = /(specification|विशिष्टिकरण|नमुना|model\s*question|question\s*paper|grid|result|notice|सूचना|प्रेस|press|vacancy|tender|बोलपत्र|circular|परिपत्र|calendar|पात्रो|teacher\s*guide|शिक्षक\s*निर्देशिका|training|तालिम)/i;

function gradeNumber(grade: string): string | null {
  return (grade.match(/\d+/) ?? [])[0] ?? null;
}

function gradeTokens(grade: string): string[] {
  const num = gradeNumber(grade);
  if (!num) return [grade.toLowerCase()];
  return [num, toNepaliNumber(num), ROMAN[num] ?? ""].filter(Boolean);
}

function subjectAliases(subject: string): string[] {
  const s = subject.toLowerCase().trim();
  const direct = SUBJECT_ALIASES[s] ?? [];
  const fuzzy = Object.entries(SUBJECT_ALIASES)
    .filter(([k]) => s.includes(k) || k.includes(s))
    .flatMap(([, v]) => v);
  const words = s.split(/[^a-z]+/).filter((w) => w.length > 4);
  return [...new Set([s, ...direct, ...fuzzy, ...words])].filter(Boolean);
}

/** Standalone-token test so "1" doesn't match "10"/"12". */
function hasGradeToken(hay: string, grade: string): boolean {
  return gradeTokens(grade).some((t) =>
    new RegExp(`(^|[^0-9०-९a-z])${t}([^0-9०-९a-z]|$)`, "i").test(hay),
  );
}

function hasSubject(hay: string, subject: string): boolean {
  return subjectAliases(subject).some((a) => a.length > 2 && hay.includes(a));
}

type MapLink = { url: string; title?: string; description?: string };

async function firecrawlMap(search: string, limit = 40): Promise<MapLink[]> {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) return [];
  try {
    const res = await fetch(`${FIRECRAWL}/map`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://moecdc.gov.np", search, limit }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const links = json?.links ?? json?.data?.links ?? [];
    return (Array.isArray(links) ? links : [])
      .map((l: unknown) => (typeof l === "string" ? { url: l } : (l as MapLink)))
      .filter((l: MapLink) => !!l?.url)
      .map((l: MapLink) => ({ ...l, url: l.url.split("#")[0]! }));
  } catch {
    return [];
  }
}

async function firecrawlRawHtml(url: string): Promise<string> {
  const key = process.env["FIRECRAWL_API_KEY"];
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
  const num = gradeNumber(grade) ?? grade;
  const ne = toNepaliNumber(num);
  const queries = subject
    ? [
        `${subjectAliases(subject)[1] ?? subject} कक्षा ${ne} पाठ्यपुस्तक`,
        `${subject} class ${num} textbook`,
      ]
    : [
        `कक्षा ${ne} पाठ्यपुस्तक`,
        `class ${num} textbook curriculum`,
      ];

  const results: MapLink[] = [];
  for (const q of queries) {
    results.push(...(await firecrawlMap(q, 40)));
  }
  const seen = new Set<string>();
  return results.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
}

function scorePage(link: MapLink, grade: string, subject: string): number {
  const hay = `${link.title ?? ""} ${link.description ?? ""} ${decodeURIComponent(link.url)}`.toLowerCase();
  if (REJECT_DOC.test(hay)) return -1;
  if (!hasGradeToken(hay, grade)) return -1;
  if (!hasSubject(hay, subject)) return -1;

  let score = 5;
  if (/\/content\//.test(link.url)) score += 3;
  if (/पाठ्यपुस्तक|textbook|book/i.test(hay)) score += 3;
  // Exact subject phrase match beats a loose alias hit.
  if (hay.includes(subject.toLowerCase())) score += 2;
  // Prefer English-edition books when the app UI is English.
  if (/अङ्ग्रेजी संस्करण|english edition/i.test(hay)) score += 1;
  return score;
}

function pdfUrlsFromHtml(html: string): string[] {
  const matches = [...html.matchAll(/https?:\/\/[^"'\s<>()]+\.pdf/gi)].map((m) => m[0]);
  return [...new Set(matches)];
}

/** A PDF is only acceptable when its filename matches grade+subject and isn't a grid/model paper. */
function pdfLooksLikeTextbook(pdfUrl: string, grade: string, subject: string): boolean {
  const name = decodeURIComponent(pdfUrl.split("/").pop() ?? "").toLowerCase();
  if (REJECT_DOC.test(name)) return false;
  // Filenames like "8.Reduced-class 9 Science final_xxx.pdf" → grade must match.
  const classNum = name.match(/(?:class|grade|कक्षा)[\s_-]*(\d{1,2})/);
  if (classNum && classNum[1] !== gradeNumber(grade)) return false;
  const subjectHit = hasSubject(name, subject);
  return Boolean(classNum || subjectHit);
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

/** The extract is only trustworthy when it actually contains a contents / unit list. */
function looksLikeToc(text: string): boolean {
  if (text.length < 500) return false;
  const t = text.toLowerCase();
  const markers = [
    /contents/,
    /विषय\s*सूची/,
    /(unit|chapter|lesson)\s*[-–:.]?\s*\d/,
    /(एकाइ|अध्याय|पाठ)\s*[-–:.]?\s*[०-९\d]/,
  ];
  const hits = markers.filter((m) => m.test(t)).length;
  return hits >= 1;
}

/** Deterministically pull chapter/unit titles out of the raw ToC text. */
export function parseTocChapters(toc: string): string[] {
  const cleaned = toc.replace(/\.{2,}/g, " ").replace(/\s+/g, " ");
  const out: string[] = [];
  const patterns = [
    /(?:unit|chapter|lesson)\s*[-–:.]?\s*(\d{1,2})\s*[:.\-–]?\s*([A-Za-z][A-Za-z0-9 ,'’&()/\-]{3,60})/gi,
    /(?:एकाइ|अध्याय|पाठ)\s*[-–:.]?\s*([०-९\d]{1,2})\s*[:.\-–]?\s*([^\d०-९]{3,60})/g,
  ];
  for (const re of patterns) {
    for (const m of cleaned.matchAll(re)) {
      const title = (m[2] ?? "").replace(/\s+/g, " ").trim().replace(/[\s,.\-–]+$/, "");
      if (title.length >= 3 && !/^page/i.test(title)) out.push(title);
    }
  }
  const seen = new Set<string>();
  return out.filter((t) => {
    const k = t.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  }).slice(0, 30);
}

export type CdcSource = {
  pageUrl: string | null;
  pageTitle: string | null;
  pdfUrl: string | null;
  toc: string;
  tocChapters: string[];
  verified: boolean;
};

const EMPTY_SOURCE: CdcSource = {
  pageUrl: null, pageTitle: null, pdfUrl: null, toc: "", tocChapters: [], verified: false,
};

/**
 * Find the official CDC textbook for grade + subject and return the real
 * Table of Contents text extracted from that PDF. `verified` is only true
 * when a genuine CDC PDF for that exact grade + subject was parsed.
 */
export async function fetchCdcTextbookSource(grade: string, subject: string): Promise<CdcSource> {
  const links = await discoverCdcPages(grade, subject);
  const ranked = links
    .map((l) => ({ l, s: scorePage(l, grade, subject) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 4);

  for (const { l } of ranked) {
    const html = await firecrawlRawHtml(l.url);
    if (!html) continue;
    const pdfs = pdfUrlsFromHtml(html).filter((p) => pdfLooksLikeTextbook(p, grade, subject));
    for (const pdf of pdfs.slice(0, 2)) {
      const toc = await pdfFrontMatter(pdf);
      if (!looksLikeToc(toc)) continue;
      return {
        pageUrl: l.url,
        pageTitle: l.title ?? null,
        pdfUrl: pdf,
        toc,
        tocChapters: parseTocChapters(toc),
        verified: true,
      };
    }
  }
  return { ...EMPTY_SOURCE, pageUrl: ranked[0]?.l.url ?? null, pageTitle: ranked[0]?.l.title ?? null };
}

/** Titles of CDC textbook pages for a grade — real subject evidence. */
export async function fetchCdcSubjectEvidence(grade: string): Promise<{ titles: string[]; urls: string[] }> {
  const links = await discoverCdcPages(grade);
  const keep = links.filter((l) => {
    const hay = `${l.title ?? ""} ${decodeURIComponent(l.url)}`.toLowerCase();
    if (REJECT_DOC.test(hay)) return false;
    if (!hasGradeToken(hay, grade)) return false;
    // Only genuine textbook / curriculum pages count as evidence.
    return /पाठ्यपुस्तक|पाठ्यक्रम|textbook|curriculum|book|\/content\//i.test(hay);
  });
  return {
    titles: [...new Set(keep.map((l) => (l.title ?? "").trim()).filter(Boolean))].slice(0, 40),
    urls: keep.map((l) => l.url).slice(0, 40),
  };
}


// ---------------------------------------------------------------------------
// Trusted Nepali publishers (Asmita, Ekta, Buddha, Sajha, ...) — used as a
// second real source when the CDC PDF cannot be reached. Chapter lists still
// come from a published book's contents page, never from the model's memory.
// ---------------------------------------------------------------------------

const PUBLISHERS: { domain: string; name: string }[] = [
  { domain: "asmitaonline.com", name: "Asmita Publication" },
  { domain: "asmitabooks.com", name: "Asmita Publication" },
  { domain: "ektabooks.com", name: "Ekta Books" },
  { domain: "buddhapublication.com", name: "Buddha Publication" },
  { domain: "sajhapublication.com", name: "Sajha Prakashan" },
  { domain: "vidyarthipustak.com", name: "Vidyarthi Pustak Bhandar" },
  { domain: "heritagepublishershouse.com", name: "Heritage Publishers" },
];

export type SearchHit = { url: string; title?: string; description?: string; markdown?: string; image?: string | null };

async function firecrawlSearch(query: string, limit = 6, scrape = true): Promise<SearchHit[]> {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) return [];
  try {
    const res = await fetch(`${FIRECRAWL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit,
        ...(scrape ? { scrapeOptions: { formats: ["markdown"], onlyMainContent: true } } : {}),
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.data?.web ?? json?.data ?? [];
    return (Array.isArray(items) ? items : []).map((i: Record<string, unknown>) => ({
      url: String(i["url"] ?? ""),
      title: (i["title"] as string) ?? "",
      description: (i["description"] as string) ?? "",
      markdown: (i["markdown"] as string) ?? "",
      image: (i["imageUrl"] as string) ?? ((i["metadata"] as Record<string, string>)?.["ogImage"] ?? null),
    })).filter((h: SearchHit) => !!h.url);
  } catch {
    return [];
  }
}

/** Pick the book-cover image out of a scraped page's raw HTML. */
export function coverFromHtml(html: string, pageUrl: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const abs = (u: string) => {
    try { return new URL(u, pageUrl).toString(); } catch { return null; }
  };
  if (og && IMAGE_EXT.test(og)) return abs(og);
  const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]!);
  const scored = imgs
    .filter((u) => IMAGE_EXT.test(u) && !/logo|icon|sprite|banner|avatar|placeholder|flag/i.test(u))
    .sort((a, b) => coverScore(b) - coverScore(a));
  return scored[0] ? abs(scored[0]) : (og ? abs(og) : null);
}
const IMAGE_EXT = /\.(png|jpe?g|webp)(\?|$)/i;
function coverScore(url: string): number {
  let s = 0;
  if (/cover|thumb|book|पुस्तक/i.test(url)) s += 4;
  if (/upload|media|product|image/i.test(url)) s += 2;
  return s;
}

/** Chapter list from a trusted publisher's book page (contents / index section). */
export async function fetchPublisherTextbookSource(
  grade: string,
  subject: string,
): Promise<CdcSource & { publisher: string | null; coverUrl: string | null }> {
  const num = gradeNumber(grade) ?? grade;
  const sites = PUBLISHERS.map((p) => `site:${p.domain}`).join(" OR ");
  const hits = await firecrawlSearch(
    `${subject} class ${num} Nepal textbook table of contents chapters ${sites}`,
    8,
  );
  for (const h of hits) {
    const hay = `${h.title ?? ""} ${decodeURIComponent(h.url)}`.toLowerCase();
    if (REJECT_DOC.test(hay)) continue;
    if (!hasGradeToken(hay, grade) && !hasGradeToken((h.markdown ?? "").slice(0, 2000).toLowerCase(), grade)) continue;
    if (!hasSubject(hay, subject) && !hasSubject((h.markdown ?? "").slice(0, 2000).toLowerCase(), subject)) continue;
    const md = h.markdown ?? "";
    if (!looksLikeToc(md)) continue;
    const chapters = parseTocChapters(md);
    if (chapters.length < 3) continue;
    const pub = PUBLISHERS.find((p) => h.url.includes(p.domain));
    let cover = h.image ?? null;
    if (!cover) {
      const html = await firecrawlRawHtml(h.url);
      cover = html ? coverFromHtml(html, h.url) : null;
    }
    return {
      pageUrl: h.url,
      pageTitle: h.title ?? null,
      pdfUrl: null,
      toc: md.slice(0, 14000),
      tocChapters: chapters,
      verified: true,
      publisher: pub?.name ?? null,
      coverUrl: cover,
    };
  }
  return { ...EMPTY_SOURCE, publisher: null, coverUrl: null };
}

/** Real cover thumbnail for a grade + subject book from CDC or a trusted publisher. */
export async function fetchBookCoverUrl(grade: string, subject: string): Promise<string | null> {
  const num = gradeNumber(grade) ?? grade;
  const hits = await firecrawlSearch(
    `${subject} class ${num} Nepal textbook book cover ${PUBLISHERS.slice(0, 4).map((p) => `site:${p.domain}`).join(" OR ")}`,
    6,
    false,
  );
  for (const h of hits) {
    if (h.image && /^https?:\/\//.test(h.image)) return h.image;
  }
  for (const h of hits.slice(0, 2)) {
    const html = await firecrawlRawHtml(h.url);
    const cover = html ? coverFromHtml(html, h.url) : null;
    if (cover) return cover;
  }
  return null;
}
