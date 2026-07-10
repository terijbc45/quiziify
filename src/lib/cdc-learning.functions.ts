import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- classes / subjects / chapters / topics ----------
export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cdc_classes")
      .select("id,grade,stream")
      .order("grade")
      .order("stream");
    if (error) throw new Error(error.message);
    return { classes: data ?? [] };
  });

const IdIn = z.object({ id: z.string().uuid() });

export const listSubjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdIn.parse(v))
  .handler(async ({ context, data }) => {
    const { data: subs, error } = await context.supabase
      .from("cdc_subjects")
      .select("id,subject_name,is_compulsory,is_optional,order_index")
      .eq("class_id", data.id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return { subjects: subs ?? [] };
  });

export const listChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdIn.parse(v))
  .handler(async ({ context, data }) => {
    const { data: chs, error } = await context.supabase
      .from("cdc_chapters")
      .select("id,chapter_number,chapter_title,order_index")
      .eq("subject_id", data.id)
      .order("order_index");
    if (error) throw new Error(error.message);
    return { chapters: chs ?? [] };
  });

export const listTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdIn.parse(v))
  .handler(async ({ context, data }) => {
    const { data: tps, error } = await context.supabase
      .from("cdc_topics")
      .select("id,topic_title,learning_objectives,order_index")
      .eq("chapter_id", data.id)
      .order("order_index");
    if (error) throw new Error(error.message);
    return { topics: tps ?? [] };
  });

export const getTopicMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdIn.parse(v))
  .handler(async ({ context, data }) => {
    const [{ data: chunks }, { data: qs }] = await Promise.all([
      context.supabase
        .from("cdc_content_chunks")
        .select("id,raw_text,source_url,source_document_name,page_reference")
        .eq("topic_id", data.id)
        .eq("verified", true),
      context.supabase
        .from("cdc_questions")
        .select("id,question_text,question_type,options,correct_answer,difficulty")
        .eq("topic_id", data.id)
        .eq("verified", true),
    ]);
    return { chunks: chunks ?? [], questions: qs ?? [] };
  });

// ---------- progress + streak ----------
const RecordIn = z.object({
  subject_id: z.string().uuid(),
  chapter_id: z.string().uuid(),
  topic_id: z.string().uuid(),
  status: z.enum(["not_started", "in_progress", "completed", "mastered"]),
  accuracy: z.number().min(0).max(100).optional(),
});
export const recordActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => RecordIn.parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("record_learning_activity", {
      _subject_id: data.subject_id,
      _chapter_id: data.chapter_id,
      _topic_id: data.topic_id,
      _status: data.status,
      _accuracy: data.accuracy ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyStreakAndProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: streak }, { data: progress }] = await Promise.all([
      context.supabase
        .from("learning_streaks")
        .select("current_streak,longest_streak,last_active_date")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("cdc_student_progress")
        .select("subject_id,topic_id,status,accuracy_percent")
        .eq("student_id", context.userId),
    ]);
    return {
      streak: streak ?? { current_streak: 0, longest_streak: 0, last_active_date: null },
      progress: progress ?? [],
    };
  });
