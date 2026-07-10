import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_cdc_admin", { _user: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

// ---------- admin bootstrap ----------
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_first_cdc_admin");
    if (error) throw new Error(error.message);
    return { claimed: data === true };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_cdc_admin", { _user: context.userId });
    const { count } = await context.supabase
      .from("cdc_admins").select("*", { count: "exact", head: true });
    return { isAdmin: !!data, adminCount: count ?? 0 };
  });

// ---------- unverified queues ----------
export const listUnverified = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: chunks }, { data: qs }, { data: logs }] = await Promise.all([
      context.supabase
        .from("cdc_content_chunks")
        .select("id,topic_id,raw_text,source_url,source_document_name,created_at")
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("cdc_questions")
        .select("id,topic_id,question_text,options,correct_answer,difficulty,created_at")
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("cdc_sync_log")
        .select("id,scope,chunks_added,questions_added,status,error_text,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    return { chunks: chunks ?? [], questions: qs ?? [], logs: logs ?? [] };
  });

const VerifyIn = z.object({ id: z.string().uuid(), kind: z.enum(["chunk", "question"]), approve: z.boolean() });
export const verifyItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => VerifyIn.parse(v))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const table = data.kind === "chunk" ? "cdc_content_chunks" : "cdc_questions";
    if (data.approve) {
      const patch: any = { verified: true };
      if (data.kind === "chunk") {
        patch.verified_by = context.userId;
        patch.verified_at = new Date().toISOString();
      }
      const { error } = await context.supabase.from(table).update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from(table).delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- Firecrawl sync ----------
const SyncIn = z.object({ subject_id: z.string().uuid() });

async function firecrawlSearch(query: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${query} site:cdc.gov.np OR site:moecdc.gov.np OR site:neb.gov.np OR site:edusanjal.com Nepal CDC NEB syllabus curriculum`,
        limit: 5,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    const items = json?.data?.web ?? json?.data ?? [];
    const context = items.slice(0, 5)
      .map((i: any) => `SOURCE ${i.url ?? ""}\nTITLE: ${i.title ?? ""}\n${(i.markdown ?? i.description ?? "").slice(0, 2000)}`)
      .join("\n\n---\n\n");
    const sourceUrl = items[0]?.url ?? null;
    return { context, sourceUrl } as any;
  } catch {
    return "";
  }
}

async function aiExtract(system: string, user: string, tool: string, schema: any) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.2,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [{ type: "function", function: { name: tool, parameters: schema } }],
      tool_choice: { type: "function", function: { name: tool } },
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : null;
}

export const syncSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SyncIn.parse(v))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);

    const { data: subject, error: sErr } = await context.supabase
      .from("cdc_subjects")
      .select("id,subject_name,class_id, cdc_classes!inner(grade,stream)")
      .eq("id", data.subject_id)
      .maybeSingle();
    if (sErr || !subject) throw new Error("Subject not found");
    const grade = (subject as any).cdc_classes.grade;
    const stream = (subject as any).cdc_classes.stream;
    const scope = `class ${grade}${stream ? ` ${stream}` : ""} - ${subject.subject_name}`;

    let chunksAdded = 0;
    let questionsAdded = 0;
    let errorText: string | null = null;

    try {
      const search = await firecrawlSearch(`Nepal class ${grade} ${subject.subject_name} chapters units syllabus contents`);
      const ctx = typeof search === "string" ? "" : search.context;
      const sourceUrl = typeof search === "string" ? null : search.sourceUrl;

      const extracted = await aiExtract(
        `You extract the OFFICIAL Nepal CDC/NEB syllabus for the given class + subject. Return chapters in textbook order. For each chapter include 2-4 topics; for each topic include 1 concise study-note chunk (150-350 words, plain facts from the syllabus) and 3 multiple-choice questions with 4 options each. Ground everything in the provided web context. Never invent citations. Difficulty must be easy|medium|hard.${ctx ? `\n\nWEB CONTEXT:\n${ctx}` : ""}`,
        `Class: ${grade}${stream ? ` (${stream})` : ""}\nSubject: ${subject.subject_name}\nExtract the full chapter list with topics, notes, and MCQs.`,
        "submit_curriculum",
        {
          type: "object",
          properties: {
            chapters: {
              type: "array", minItems: 3, maxItems: 20,
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  topics: {
                    type: "array", minItems: 1, maxItems: 6,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        learning_objectives: { type: "array", items: { type: "string" }, maxItems: 4 },
                        note: { type: "string" },
                        questions: {
                          type: "array", minItems: 2, maxItems: 5,
                          items: {
                            type: "object",
                            properties: {
                              q: { type: "string" },
                              options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                              answer: { type: "string" },
                              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                            },
                            required: ["q", "options", "answer", "difficulty"], additionalProperties: false,
                          },
                        },
                      },
                      required: ["title", "note", "questions"], additionalProperties: false,
                    },
                  },
                },
                required: ["title", "topics"], additionalProperties: false,
              },
            },
          },
          required: ["chapters"], additionalProperties: false,
        },
      );

      if (!extracted?.chapters?.length) throw new Error("No curriculum extracted");

      // Existing chapters keyed by title to avoid dup inserts
      const { data: existing } = await context.supabase
        .from("cdc_chapters").select("id,chapter_title,order_index").eq("subject_id", data.subject_id);
      const byTitle = new Map<string, string>((existing ?? []).map((c: any) => [c.chapter_title.toLowerCase(), c.id]));
      let nextOrder = (existing ?? []).reduce((m: number, c: any) => Math.max(m, c.order_index ?? 0), 0);

      for (const [ci, ch] of (extracted.chapters as any[]).entries()) {
        let chapterId = byTitle.get(ch.title.toLowerCase());
        if (!chapterId) {
          nextOrder += 1;
          const { data: insCh, error: chErr } = await context.supabase
            .from("cdc_chapters")
            .insert({ subject_id: data.subject_id, chapter_number: nextOrder, chapter_title: ch.title, order_index: nextOrder })
            .select("id").single();
          if (chErr) throw new Error(chErr.message);
          chapterId = insCh.id;
        }

        for (const [ti, tp] of (ch.topics as any[]).entries()) {
          // Get or create topic
          const { data: existingTopic } = await context.supabase
            .from("cdc_topics").select("id").eq("chapter_id", chapterId).ilike("topic_title", tp.title).maybeSingle();
          let topicId = existingTopic?.id;
          if (!topicId) {
            const { data: insTp, error: tpErr } = await context.supabase
              .from("cdc_topics")
              .insert({
                chapter_id: chapterId,
                topic_title: tp.title,
                learning_objectives: tp.learning_objectives ?? [],
                order_index: ti + 1,
              })
              .select("id").single();
            if (tpErr) throw new Error(tpErr.message);
            topicId = insTp.id;
          }

          // Insert unverified content chunk
          const { data: insChunk, error: chunkErr } = await context.supabase
            .from("cdc_content_chunks")
            .insert({
              topic_id: topicId,
              raw_text: tp.note,
              source_url: sourceUrl,
              source_document_name: "Firecrawl sync (CDC/NEB)",
              verified: false,
              last_synced_at: new Date().toISOString(),
            })
            .select("id").single();
          if (chunkErr) throw new Error(chunkErr.message);
          chunksAdded += 1;

          for (const q of tp.questions as any[]) {
            const { error: qErr } = await context.supabase.from("cdc_questions").insert({
              topic_id: topicId,
              question_text: q.q,
              question_type: "MCQ",
              options: q.options,
              correct_answer: q.answer,
              difficulty: q.difficulty,
              source_chunk_id: insChunk.id,
              verified: false,
            });
            if (qErr) throw new Error(qErr.message);
            questionsAdded += 1;
          }
        }
      }
    } catch (e: any) {
      errorText = e?.message ?? String(e);
    }

    await context.supabase.from("cdc_sync_log").insert({
      run_by: context.userId,
      scope,
      chunks_added: chunksAdded,
      questions_added: questionsAdded,
      status: errorText ? "error" : "ok",
      error_text: errorText,
    });

    if (errorText) throw new Error(errorText);
    return { chunksAdded, questionsAdded };
  });
