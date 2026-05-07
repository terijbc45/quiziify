import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const Question = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correct_index: z.number().min(0).max(3),
  explanation: z.string(),
  emoji: z.string().optional(),
});
const QuestionSet = z.object({ questions: z.array(Question).min(1) });

import { fetchLatestSnippets } from "./firecrawl.server";

const Input = z.object({
  count: z.number().min(1).max(10).default(5),
  avoid: z.array(z.string()).max(200).optional(),
  nonce: z.string().max(64).optional(),
  includeLatest: z.boolean().optional(),
});

export const generateRamailoQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AI not configured", questions: [] as z.infer<typeof Question>[] };

    const avoidHint = data.avoid && data.avoid.length > 0
      ? ` Do NOT repeat these previously-asked questions: ${data.avoid.slice(0, 60).map((q) => `"${q.slice(0, 80)}"`).join("; ")}.`
      : "";

    const seed = data.nonce ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let latestBlock = "";
    if (data.includeLatest) {
      const snippets = await fetchLatestSnippets();
      if (snippets) {
        latestBlock = `\n\nFor 1-2 of the questions, draw inspiration from these REAL recent headlines (paraphrase, never copy):\n${snippets}`;
      }
    }

    const sysPrompt = `You generate VERY SIMPLE, fun, super-popular general-knowledge ("Ramailo") MCQs. Think: "What is the capital of France?", "What is a network of networks?", "Who painted the Mona Lisa?", "Which planet is the Red Planet?". Mix everyday categories: world capitals, famous people, basic science, sports, movies, food, animals, geography, simple tech, history milestones. Keep each question short (under 90 chars). Make options short and clearly distinct. Be light and friendly.${avoidHint}${latestBlock}\n\nVariation seed (do not mention): ${seed}. Each question must have exactly 4 options, one correct answer, a brief one-sentence explanation, and an emoji.`;

    try {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: 1.1,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: `Generate ${data.count} fresh, distinct very simple questions.` },
          ],
          tools: [{
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
                        emoji: { type: "string" },
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
          }],
          tool_choice: { type: "function", function: { name: "submit_questions" } },
        }),
      });
      if (!res.ok) {
        if (res.status === 429) return { error: "Rate limit reached. Please wait a moment.", questions: [] };
        if (res.status === 402) return { error: "AI credits exhausted.", questions: [] };
        return { error: "AI service error", questions: [] };
      }
      const json = await res.json();
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { error: "No questions returned", questions: [] };
      const parsed = QuestionSet.parse(JSON.parse(args));
      return { error: null, questions: parsed.questions };
    } catch (e) {
      console.error("generateRamailoQuestions error", e);
      return { error: "Failed to generate questions", questions: [] };
    }
  });
