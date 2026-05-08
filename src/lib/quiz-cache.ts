import { supabase } from "@/integrations/supabase/client";
import { generateQuestions } from "@/server/quiz.functions";
import { generateRamailoQuestions } from "@/server/ramailo.functions";
import type { QuizQuestion } from "@/components/QuizPlayer";

// Simple deterministic hash so we can de-dupe across sessions
export function hashQuestion(q: string): string {
  let h = 0;
  const s = q.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return `h${(h >>> 0).toString(36)}`;
}

export async function fetchSeenQuestions(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("seen_questions")
    .select("question_hash")
    .eq("user_id", userId)
    .limit(500);
  return (data ?? []).map((d) => d.question_hash);
}

export async function recordSeen(
  userId: string,
  questions: QuizQuestion[],
  mode: string,
  level?: number,
) {
  const rows = questions.map((q) => ({
    user_id: userId,
    question_hash: hashQuestion(q.question),
    mode,
    level: level ?? null,
  }));
  if (rows.length === 0) return;
  await supabase.from("seen_questions").upsert(rows, { onConflict: "user_id,question_hash", ignoreDuplicates: true });
}

// Two models to alternate so consecutive rounds get fresh styling and parallelize well.
export const PRIMARY_MODEL = "google/gemini-2.5-flash";
export const SECONDARY_MODEL = "google/gemini-2.5-flash-lite";

// In-memory cache of pre-generated quiz sets keyed by cache key.
const cache = new Map<string, Promise<{ error: string | null; questions: QuizQuestion[] }>>();

export function prefetchQuiz(
  cacheKey: string,
  params: { topic: string; difficulty: "easy" | "intermediate" | "hard"; count: number; level?: number; avoid?: string[]; nonce?: string; includeLatest?: boolean; model?: string },
) {
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  const p = generateQuestions({ data: params }).then((r) => ({
    error: r.error,
    questions: r.questions.map((q) => ({ ...q, author: null, image_url: null })) as QuizQuestion[],
  }));
  cache.set(cacheKey, p);
  return p;
}

export function prefetchRamailo(
  cacheKey: string,
  params: { count: number; avoid?: string[]; nonce?: string; includeLatest?: boolean; category?: "random" | "logo" | "places" | "food_animals"; model?: string },
) {
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  const p = generateRamailoQuestions({ data: params }).then((r) => ({
    error: r.error,
    questions: r.questions.map((q) => ({ ...q, author: null, image_url: q.image_url || null })) as QuizQuestion[],
  }));
  cache.set(cacheKey, p);
  return p;
}

export function consumeCachedQuiz(cacheKey: string) {
  const p = cache.get(cacheKey);
  cache.delete(cacheKey);
  return p;
}

export function clearQuizCache(prefix?: string) {
  if (!prefix) { cache.clear(); return; }
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
