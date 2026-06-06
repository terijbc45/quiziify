import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { fetchSubjectImage, fetchChapterImage } from "../server/firecrawl-images.server";

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
    const nepalQuery = `${query} site:cdc.gov.np OR site:moecdc.gov.np OR site:neb.gov.np OR site:moest.gov.np OR site:edusanjal.com Nepal CDC Curriculum Development Centre NEB`;
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: nepalQuery, limit: 6, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    const items = json?.data?.web ?? json?.data ?? [];
    return items.slice(0, 6).map((i: any) => `- ${i.title ?? ""}: ${(i.markdown ?? i.description ?? "").slice(0, 1200)}`).join("\n");
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
        temperature: 0.3,
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
type Subject = { name: string; emoji: string; blurb: string; image_url?: string | null };
type SubjectsInput = z.infer<typeof SubjectsIn>;

export const fetchSubjects = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): SubjectsInput => SubjectsIn.parse(input))
  .handler(async ({ data }) => {
    const ck = `subjects:v3:${data.country.toLowerCase()}:${data.grade.toLowerCase()}`;
    const cached = await cacheGet<{ subjects: Subject[] }>(ck);
    if (cached?.subjects?.length) return { subjects: cached.subjects };

    const ctx = await firecrawlContext(`Nepal ${data.grade} school subjects CDC curriculum syllabus NEB compulsory optional SEE`);
    const out = await aiExtract<{ subjects: Subject[] }>(
      `You list the COMPLETE OFFICIAL school subjects studied in NEPAL for the given grade according to the Nepal Curriculum Development Centre (CDC, Sanothimi Bhaktapur) and the National Examinations Board (NEB, for class 11-12). For class 8-10 you MUST list every standard subject offered for SEE preparation — this typically includes ALL of: Nepali, English, Compulsory Mathematics, Optional Mathematics, Science (Compulsory Science) [class 9-10], Social Studies (Samajik Adhyayan), Health-Population-Environment / Population Studies, Computer Science / Computer Applications, Occupation Business & Technology Education (OBTE), Moral Education, Accountancy / Bookkeeping, Economics, plus any local/optional subject (Sanskrit, regional language). For class 11-12 list the NEB compulsory subjects PLUS the popular faculty groupings (Science: Physics, Chemistry, Biology/Mathematics; Management: Accountancy, Business Studies, Economics, Hotel Management; Humanities: Sociology, Psychology, Political Science, Geography; Education). Output EVERY subject — do NOT cap or omit. Each subject has a single emoji and one-line blurb. Use the provided web context (Nepal CDC / NEB / edusanjal) as ground truth.${ctx ? `\n\nWEB CONTEXT:\n${ctx}` : ""}`,
      `Country: Nepal\nGrade/Class: ${data.grade}\nList every standard CDC / NEB subject for this class — compulsory AND optional groupings. Do not skip any.`,
      "submit_subjects",
      {
        type: "object",
        properties: {
          subjects: {
            type: "array", minItems: 6, maxItems: 24,
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

    // Enrich with real images via Firecrawl.
    const enriched = await Promise.all(out.subjects.map(async (s) => ({
      ...s,
      image_url: await fetchSubjectImage(s.name, data.grade).catch(() => null),
    })));
    const payload = { subjects: enriched };
    await cacheSet(ck, payload);
    return payload;
  });

// ---------- Chapters ----------
const ChaptersIn = SubjectsIn.extend({ subject: z.string().min(1).max(80) });
type Chapter = { name: string; emoji: string; summary: string; image_url?: string | null };
type ChaptersInput = z.infer<typeof ChaptersIn>;

export const fetchChapters = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): ChaptersInput => ChaptersIn.parse(input))
  .handler(async ({ data }) => {
    const ck = `chapters:v2:${data.country.toLowerCase()}:${data.grade.toLowerCase()}:${data.subject.toLowerCase()}`;
    const cached = await cacheGet<{ chapters: Chapter[]; context: string }>(ck);
    if (cached?.chapters?.length) return cached;

    const ctx = await firecrawlContext(`Nepal ${data.grade} ${data.subject} chapters table of contents syllabus CDC NEB`);
    const out = await aiExtract<{ chapters: Chapter[] }>(
      `You list the COMPLETE OFFICIAL chapter / unit names of the given subject for the given grade in NEPAL, in textbook order, based on the current Nepal Curriculum Development Centre (CDC) syllabus (class 8-10) or NEB syllabus (class 11-12). Output EVERY chapter — match the real textbook's count exactly (do NOT cap at 10; many NEB books have 12-20 units). Each chapter has a single emoji and a one-line summary. Use the provided web context (Nepal CDC / NEB / edusanjal) as ground truth.${ctx ? `\n\nWEB CONTEXT:\n${ctx}` : ""}`,
      `Country: Nepal\nGrade: ${data.grade}\nSubject: ${data.subject}\nList every chapter in textbook order, in full.`,
      "submit_chapters",
      {
        type: "object",
        properties: {
          chapters: {
            type: "array", minItems: 4, maxItems: 30,
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

    const enriched = await Promise.all(out.chapters.map(async (c) => ({
      ...c,
      image_url: await fetchChapterImage(data.subject, c.name).catch(() => null),
    })));
    const payload = { chapters: enriched, context: ctx.slice(0, 2500) };
    await cacheSet(ck, payload);
    return payload;
  });

// ---------- Curriculum context (used to ground quiz questions) ----------
const CtxIn = z.object({
  country: z.string().min(2).max(80),
  grade: z.string().min(1).max(40),
  subject: z.string().min(1).max(80),
  chapter: z.string().min(1).max(120).optional(),
});
type CurriculumContextInput = z.infer<typeof CtxIn>;

export const fetchCurriculumContext = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): CurriculumContextInput => CtxIn.parse(input))
  .handler(async ({ data }) => {
    const q = data.chapter
      ? `Nepal CDC NEB ${data.grade} ${data.subject} chapter "${data.chapter}" key concepts syllabus`
      : `Nepal CDC NEB ${data.grade} ${data.subject} curriculum key topics syllabus`;
    const ctx = await firecrawlContext(q);
    return { context: ctx.slice(0, 2500) };
  });
