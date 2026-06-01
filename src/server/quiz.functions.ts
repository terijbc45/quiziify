import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchLatestSnippets } from "./firecrawl.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const Question = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correct_index: z.number().min(0).max(3),
  explanation: z.string(),
  emoji: z.string().optional(),
});

const QuestionSet = z.object({ questions: z.array(Question).min(1) });

const Input = z.object({
  topic: z.string().min(1).max(120),
  difficulty: z.enum(["easy", "intermediate", "hard"]),
  count: z.number().min(1).max(10).default(5),
  level: z.number().optional(),
  avoid: z.array(z.string()).max(200).optional(),
  nonce: z.string().max(64).optional(),
  includeLatest: z.boolean().optional(),
  model: z.string().max(80).optional(),
  curriculumContext: z.string().max(4000).optional(),
  country: z.string().max(80).optional(),
  grade: z.string().max(40).optional(),
  subject: z.string().max(80).optional(),
  chapter: z.string().max(120).optional(),
});

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AI not configured", questions: [] as z.infer<typeof Question>[] };

    const levelHint = data.level
      ? ` This is LEVEL ${data.level}. Difficulty must scale: L1-3 very easy, L4-7 easy, L8-15 intermediate, L16-25 hard, L26-40 very hard, L40+ expert/obscure trivia. Higher levels MUST be noticeably harder.`
      : "";

    const avoidHint = data.avoid && data.avoid.length > 0
      ? ` Do NOT repeat or paraphrase any of these previously-shown question topics: ${data.avoid.slice(0, 60).map((q) => `"${q.slice(0, 80)}"`).join("; ")}. Pick fresh angles.`
      : "";

    const variety = [
      "obscure facts",
      "real-world applications",
      "historical context",
      "common misconceptions",
      "surprising connections",
      "famous figures",
      "modern discoveries",
      "edge cases and trivia",
    ];
    const angle = variety[Math.floor(Math.random() * variety.length)];
    const seed = data.nonce ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let latestBlock = "";
    if (data.includeLatest) {
      const snippets = await fetchLatestSnippets(data.topic);
      if (snippets) {
        latestBlock = `\n\nFor 1-2 of the questions, draw inspiration from these REAL recent headlines (paraphrase, never copy verbatim):\n${snippets}`;
      }
    }

    const curriculumBlock = data.curriculumContext
      ? `\n\nCURRICULUM GROUND TRUTH (from official syllabus — base every question STRICTLY on these topics; do NOT ask anything outside this scope):\nCountry: ${data.country ?? ""} | Grade: ${data.grade ?? ""} | Subject: ${data.subject ?? ""}${data.chapter ? ` | Chapter: ${data.chapter}` : ""}\n${data.curriculumContext}`
      : "";

    const sysPrompt = `You generate sharp, brain-stimulating ${data.curriculumContext ? "school-curriculum" : "general-knowledge"} MCQs designed to make people smarter through interactive practice. Difficulty: ${data.difficulty}.${levelHint} Topic: ${data.topic === "any" ? "ALL fields — mix widely across science, history, geography, math, language, arts, tech, sports, pop-culture, current affairs, biology, chemistry, physics, world cultures" : data.topic}.${avoidHint} For this batch, lean into: ${angle}. Be unpredictable — never recycle classic textbook examples. Variation seed (do NOT mention): ${seed}.${latestBlock}${curriculumBlock}\n\nFORMAT RULES (strict):\n- Default question length: SHORT and clear (one sentence, ~60-130 chars). Only go longer (up to ~220 chars) when extra context is genuinely needed — e.g. specific scientific research, experiments, historic events, or technical questions that require setup for clarity.\n- Each of the 4 options MUST be very short — 1-3 words ideally, NEVER more than 5 words. No full sentences in options.\n- Provide ONE emoji visually representing the subject and a one-sentence explanation.\n- Be accurate, varied, and creative.`;

    try {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: data.model ?? "google/gemini-2.5-flash",
          temperature: 1.1,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: `Generate ${data.count} fresh, distinct questions. Avoid anything resembling a previously asked question.` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "submit_questions",
                description: "Return the quiz question set",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question: { type: "string" },
                          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                          correct_index: { type: "integer", minimum: 0, maximum: 3 },
                          explanation: { type: "string" },
                          emoji: { type: "string", description: "single emoji representing the subject" },
                        },
                        required: ["question", "options", "correct_index", "explanation", "emoji"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["questions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "submit_questions" } },
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        if (res.status === 429) return { error: "Rate limit reached. Please wait a moment.", questions: [] };
        if (res.status === 402) return { error: "AI credits exhausted. Add credits in Settings → Workspace → Usage.", questions: [] };
        console.error("AI gateway error:", res.status, txt);
        return { error: "AI service error", questions: [] };
      }

      const json = await res.json();
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { error: "No questions returned", questions: [] };
      const parsed = QuestionSet.parse(JSON.parse(args));
      return { error: null, questions: parsed.questions };
    } catch (e) {
      console.error("generateQuestions error", e);
      return { error: "Failed to generate questions", questions: [] };
    }
  });

const SummaryInput = z.object({
  question: z.string().min(1).max(500),
  correct_answer: z.string().min(1).max(300),
});

export const explainQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SummaryInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AI not configured", summary: "" };

    try {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are an engaging tutor. Given a quiz question and its correct answer, return a vivid, interactive long-form summary in markdown. Use headings (##), bullet points, bold key terms, fun analogies, and a final 'Quick recap' section. Keep it to ~250-350 words. Make it lively with relevant emojis sprinkled in.",
            },
            {
              role: "user",
              content: `Question: ${data.question}\nCorrect answer: ${data.correct_answer}\n\nWrite the interactive summary.`,
            },
          ],
        }),
      });

      if (!res.ok) {
        if (res.status === 429) return { error: "Rate limit reached.", summary: "" };
        if (res.status === 402) return { error: "AI credits exhausted.", summary: "" };
        return { error: "AI service error", summary: "" };
      }

      const json = await res.json();
      const summary = json.choices?.[0]?.message?.content ?? "";
      return { error: null, summary };
    } catch (e) {
      console.error("explainQuestion error", e);
      return { error: "Failed to load summary", summary: "" };
    }
  });
