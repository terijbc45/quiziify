import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const Question = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correct_index: z.number().min(0).max(3),
  explanation: z.string(),
});

const QuestionSet = z.object({ questions: z.array(Question).min(1) });

const Input = z.object({
  topic: z.string().min(1).max(80),
  difficulty: z.enum(["easy", "intermediate", "hard"]),
  count: z.number().min(1).max(10).default(5),
  level: z.number().optional(),
});

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AI not configured", questions: [] as z.infer<typeof Question>[] };

    const levelHint = data.level
      ? ` This is LEVEL ${data.level}. Higher level = harder. Scale challenge accordingly: levels 1-5 beginner, 6-15 intermediate, 16-30 advanced, 30+ expert/obscure.`
      : "";

    const sysPrompt = `You generate high-quality multiple choice quiz questions. Difficulty: ${data.difficulty}.${levelHint} Topic: ${data.topic === "any" ? "any field — vary topics across science, history, geography, math, language, arts, tech, sports" : data.topic}. Each question must have exactly 4 options, one correct answer, and a one-sentence explanation. Be accurate, clear, and varied.`;

    try {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: `Generate ${data.count} questions.` },
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
                        },
                        required: ["question", "options", "correct_index", "explanation"],
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
