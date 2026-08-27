import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiTool, bookExtract, cacheGet, cacheSet } from "../server/study.server";

const StudyIn = z.object({
  grade: z.string().min(1).max(40),
  subject: z.string().min(1).max(80),
  chapter: z.string().min(1).max(160),
  language: z.enum(["en", "ne"]).optional(),
});
type StudyInput = z.infer<typeof StudyIn>;

export type Flashcard = { front: string; back: string; hint?: string };
export type PodcastLine = { speaker: "Host" | "Guest"; text: string };

const MODEL = "google/gemini-2.5-flash";

function grounding(toc: string | undefined, subject: string, chapter: string, grade: string) {
  return toc
    ? `\n\nVERIFIED BOOK EXTRACT (real Nepali textbook front matter / contents for ${subject}, ${grade}). Stay inside the scope of the unit "${chapter}" as it appears here:\n${toc.slice(0, 8000)}`
    : `\n\nNo book extract is available, so stay strictly within what Nepal's CDC syllabus covers for "${chapter}" in ${subject} (${grade}). Never invent facts.`;
}

// ---------- Flashcards ----------
export const generateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): StudyInput => StudyIn.parse(input))
  .handler(async ({ data }) => {
    const lang = data.language ?? "en";
    const ck = `flashcards:v1:${lang}:${data.grade.toLowerCase()}:${data.subject.toLowerCase()}:${data.chapter.toLowerCase()}`;
    const cached = await cacheGet<{ cards: Flashcard[] }>(ck);
    if (cached?.cards?.length) return cached;

    const src = await bookExtract(data.grade, data.subject);
    const out = await aiTool<{ cards: Flashcard[] }>(
      MODEL,
      `You are a Nepali secondary-school teacher creating revision flashcards for one textbook unit. Each card has a short prompt on the front (a term, question, formula or date) and a crisp 1-3 sentence answer on the back, plus an optional one-line hint. Cover the unit's key definitions, processes, formulas, dates and examples — no trivia, no repetition. ${lang === "ne" ? "Write every card in Nepali (Devanagari)." : "Write every card in clear, simple English."}${grounding(src?.toc, data.subject, data.chapter, data.grade)}`,
      `Grade: ${data.grade}\nSubject: ${data.subject}\nUnit: ${data.chapter}\nCreate 14 flashcards for this unit.`,
      "submit_flashcards",
      {
        type: "object",
        properties: {
          cards: {
            type: "array",
            minItems: 8,
            maxItems: 18,
            items: {
              type: "object",
              properties: {
                front: { type: "string" },
                back: { type: "string" },
                hint: { type: "string" },
              },
              required: ["front", "back"],
              additionalProperties: false,
            },
          },
        },
        required: ["cards"],
        additionalProperties: false,
      },
    );
    const cards = (out?.cards ?? []).filter((c) => c.front?.trim() && c.back?.trim());
    if (!cards.length) throw new Error("Couldn't build flashcards for this chapter. Please try again.");
    const payload = { cards, source_url: src?.pdfUrl ?? src?.pageUrl ?? null };
    await cacheSet(ck, payload);
    return payload;
  });

// ---------- Podcast ----------
export const generatePodcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): StudyInput => StudyIn.parse(input))
  .handler(async ({ data }) => {
    const lang = data.language ?? "en";
    const ck = `podcast:v1:${lang}:${data.grade.toLowerCase()}:${data.subject.toLowerCase()}:${data.chapter.toLowerCase()}`;
    const cached = await cacheGet<{ title: string; summary?: string; lines: PodcastLine[] }>(ck);
    if (cached?.lines?.length) return cached;

    const src = await bookExtract(data.grade, data.subject);
    const out = await aiTool<{ title: string; summary: string; lines: PodcastLine[] }>(
      MODEL,
      `You script a two-person study podcast that explains ONE textbook unit to a Nepali student. "Host" is a curious student who asks the questions a learner would actually ask; "Guest" is the teacher who explains with everyday Nepali examples, analogies and exam tips. Keep every line spoken-word short (1-3 sentences), alternate speakers, open with a hook, end with a 3-point recap. Teach only what the unit really covers. ${lang === "ne" ? "Write the whole script in natural spoken Nepali (Devanagari)." : "Write the whole script in simple spoken English."}${grounding(src?.toc, data.subject, data.chapter, data.grade)}`,
      `Grade: ${data.grade}\nSubject: ${data.subject}\nUnit: ${data.chapter}\nWrite a 20-28 line episode.`,
      "submit_episode",
      {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          lines: {
            type: "array",
            minItems: 12,
            maxItems: 34,
            items: {
              type: "object",
              properties: {
                speaker: { type: "string", enum: ["Host", "Guest"] },
                text: { type: "string" },
              },
              required: ["speaker", "text"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "summary", "lines"],
        additionalProperties: false,
      },
    );
    const lines = (out?.lines ?? []).filter((l) => l.text?.trim());
    if (!lines.length) throw new Error("Couldn't record this episode. Please try again.");
    const payload = {
      title: out?.title ?? `${data.chapter} — study session`,
      summary: out?.summary ?? "",
      lines,
      source_url: src?.pdfUrl ?? src?.pageUrl ?? null,
    };
    await cacheSet(ck, payload);
    return payload;
  });
