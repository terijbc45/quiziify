import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const { data } = await admin().from("curriculum_cache").select("payload,fetched_at").eq("key", key).maybeSingle();
    if (!data) return null;
    // 30-day TTL
    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > 1000 * 60 * 60 * 24 * 30) return null;
    return data.payload as T;
  } catch { return null; }
}
async function cacheSet(key: string, payload: unknown) {
  try { await admin().from("curriculum_cache").upsert({ key, payload, fetched_at: new Date().toISOString() }, { onConflict: "key" }); } catch {}
}

async function firecrawlContext(query: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  try {
    // Bias toward Nepal Curriculum Development Centre + official .gov.np / .edu.np sources.
    const nepalQuery = `${query} site:cdc.gov.np OR site:moecdc.gov.np OR site:moest.gov.np OR site:edusanjal.com OR Nepal CDC Curriculum Development Centre`;
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: nepalQuery, limit: 5, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    const items = json?.data?.web ?? json?.data ?? [];
    return items.slice(0, 5).map((i: any) => `- ${i.title ?? ""}: ${(i.markdown ?? i.description ?? "").slice(0, 800)}`).join("\n");
  } catch { return ""; }
}

async function aiExtract<T>(systemPrompt: string, userPrompt: string, toolName: string, schema: any): Promise<T | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.4,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{ type: "function", function: { name: toolName, parameters: schema } }],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? JSON.parse(args) as T : null;
  } catch { return null; }
}

// ---------- Subjects ----------
const SubjectsIn = z.object({ country: z.string().min(2).max(80), grade: z.string().min(1).max(40) });
type Subject = { name: string; emoji: string; blurb: string };

export const fetchSubjects = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SubjectsIn.parse(i))
  .handler(async ({ data }) => {
    const ck = `subjects:${data.country.toLowerCase()}:${data.grade.toLowerCase()}`;
    const cached = await cacheGet<{ subjects: Subject[] }>(ck);
    if (cached?.subjects?.length) return { subjects: cached.subjects };

    const ctx = await firecrawlContext(`Nepal ${data.grade} school subjects CDC curriculum syllabus`);
    const out = await aiExtract<{ subjects: Subject[] }>(
      `You list the OFFICIAL school subjects studied in NEPAL for the given grade according to the Curriculum Development Centre (CDC, Sanothimi Bhaktapur) — Nepal's government curriculum authority. Output 6-10 subjects, each with a single emoji and a short 1-line blurb. Use the provided real web context (Nepal CDC / government sources) as ground truth.${ctx ? `\n\nWEB CONTEXT:\n${ctx}` : ""}`,
      `Country: Nepal\nGrade/Class: ${data.grade}\nList the standard CDC Nepal subjects.`,
      "submit_subjects",
      {
        type: "object",
        properties: {
          subjects: {
            type: "array", minItems: 4, maxItems: 12,
            items: {
              type: "object",
              properties: { name: { type: "string" }, emoji: { type: "string" }, blurb: { type: "string" } },
              required: ["name", "emoji", "blurb"], additionalProperties: false,
            },
          },
        },
        required: ["subjects"], additionalProperties: false,
      },
    );
    if (!out?.subjects?.length) return { subjects: [] as Subject[] };
    await cacheSet(ck, out);
    return out;
  });

// ---------- Chapters ----------
const ChaptersIn = SubjectsIn.extend({ subject: z.string().min(1).max(80) });
type Chapter = { name: string; emoji: string; summary: string };

export const fetchChapters = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ChaptersIn.parse(i))
  .handler(async ({ data }) => {
    const ck = `chapters:${data.country.toLowerCase()}:${data.grade.toLowerCase()}:${data.subject.toLowerCase()}`;
    const cached = await cacheGet<{ chapters: Chapter[]; context: string }>(ck);
    if (cached?.chapters?.length) return cached;

    const ctx = await firecrawlContext(`${data.country} ${data.grade} ${data.subject} chapters syllabus index`);
    const out = await aiExtract<{ chapters: Chapter[] }>(
      `You list the OFFICIAL chapter/unit names of the given subject for the given country & grade, in textbook order, based on the real current curriculum. Output 6-15 chapters. Each has a single emoji + 1-line summary. Use the provided web context as ground truth.${ctx ? `\n\nWEB CONTEXT:\n${ctx}` : ""}`,
      `Country: ${data.country}\nGrade: ${data.grade}\nSubject: ${data.subject}\nList chapters in order.`,
      "submit_chapters",
      {
        type: "object",
        properties: {
          chapters: {
            type: "array", minItems: 4, maxItems: 20,
            items: {
              type: "object",
              properties: { name: { type: "string" }, emoji: { type: "string" }, summary: { type: "string" } },
              required: ["name", "emoji", "summary"], additionalProperties: false,
            },
          },
        },
        required: ["chapters"], additionalProperties: false,
      },
    );
    if (!out?.chapters?.length) return { chapters: [] as Chapter[], context: "" };
    const payload = { chapters: out.chapters, context: ctx.slice(0, 2000) };
    await cacheSet(ck, payload);
    return payload;
  });

// ---------- Curriculum context fetcher (used to ground quiz questions) ----------
const CtxIn = z.object({
  country: z.string().min(2).max(80),
  grade: z.string().min(1).max(40),
  subject: z.string().min(1).max(80),
  chapter: z.string().min(1).max(120).optional(),
});

export const fetchCurriculumContext = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CtxIn.parse(i))
  .handler(async ({ data }) => {
    const q = data.chapter
      ? `${data.country} ${data.grade} ${data.subject} chapter "${data.chapter}" key concepts`
      : `${data.country} ${data.grade} ${data.subject} curriculum key topics`;
    const ctx = await firecrawlContext(q);
    return { context: ctx.slice(0, 2500) };
  });
