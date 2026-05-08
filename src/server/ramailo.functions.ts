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
  // For logo / place categories the AI returns a subject we use to fetch an image
  subject: z.string().optional(),
  image_url: z.string().optional(),
  domain: z.string().optional(),
  country_code: z.string().optional(),
});
const QuestionSet = z.object({ questions: z.array(Question).min(1) });

const Categories = z.enum(["random", "logo", "places", "food_animals"]);

const Input = z.object({
  count: z.number().min(1).max(10).default(5),
  avoid: z.array(z.string()).max(200).optional(),
  nonce: z.string().max(64).optional(),
  includeLatest: z.boolean().optional(),
  category: Categories.optional(),
  model: z.string().max(80).optional(),
});

function categoryPrompt(cat: z.infer<typeof Categories>): string {
  switch (cat) {
    case "logo":
      return `Generate "guess the brand from its logo" questions. For EACH question:
- Pick a globally famous brand/company (e.g. Apple, Nike, McDonald's, Google, Toyota, Coca-Cola, Samsung, Adidas, BMW, Spotify, Netflix, IKEA, etc.). Vary across tech, food, fashion, cars, retail.
- "subject" = the brand name only.
- "domain" = the brand's primary website domain (e.g. "apple.com", "nike.com") for logo lookup.
- Question should be short like: "Which company's logo is this?" (you can vary phrasing).
- Options: 4 short brand names. correct_index points to the right one.`;
    case "places":
      return `Generate "guess the place" questions. Mix two styles roughly 50/50:
(A) Country flag → "Which country's flag is this?" — set "country_code" to the ISO 3166-1 alpha-2 code (lowercase, e.g. "fr", "jp", "br") and "subject" to the country name.
(B) Famous monuments / landmarks / cities → "Where is the Eiffel Tower located?" / "Which city is the Colosseum in?" — set "subject" to the monument name; you may set "domain" empty.
Options must be short (1-3 words). Mix continents.`;
    case "food_animals":
      return `Generate fun trivia mixing famous foods and animals from around the world: dishes, fruits, drinks, mammals, birds, sea creatures, insects. E.g. "Which country is sushi from?", "Fastest land animal?", "What animal is a 'joey'?", "Pizza margherita originated in?". Use a vivid emoji per question.`;
    case "random":
    default:
      return `Generate fun, broad general-knowledge questions: capitals, science, sports, movies, history, simple tech, geography. Use a vivid emoji per question.`;
  }
}

export const generateRamailoQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AI not configured", questions: [] as z.infer<typeof Question>[] };

    const cat = data.category ?? "random";
    const avoidHint = data.avoid && data.avoid.length > 0
      ? ` Do NOT repeat these previously-asked questions: ${data.avoid.slice(0, 60).map((q) => `"${q.slice(0, 80)}"`).join("; ")}.`
      : "";

    const seed = data.nonce ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let latestBlock = "";
    if (data.includeLatest && cat === "random") {
      const snippets = await fetchLatestSnippets();
      if (snippets) {
        latestBlock = `\n\nFor 1-2 of the questions, draw inspiration from these REAL recent headlines (paraphrase, never copy):\n${snippets}`;
      }
    }

    const sysPrompt = `You generate VERY SIMPLE, fun, popular general-knowledge ("Ramailo") MCQs.
${categoryPrompt(cat)}
RULES:
(1) Question text SHORT — under 80 chars (longer only if a specific monument/event needs clarity).
(2) Each of the 4 options must be 1-2 words, never more than 4 words.
(3) Always include a vivid emoji.
${avoidHint}${latestBlock}

Variation seed (do not mention): ${seed}.`;

    try {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: data.model ?? "google/gemini-2.5-flash",
          temperature: 1.1,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: `Generate ${data.count} fresh, distinct questions for category "${cat}".` },
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
                        subject: { type: "string" },
                        domain: { type: "string" },
                        country_code: { type: "string" },
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

      // Resolve image_url server-side based on category
      const enriched = parsed.questions.map((q) => {
        let image_url = q.image_url ?? "";
        if (cat === "logo" && q.domain) {
          image_url = `https://logo.clearbit.com/${q.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}?size=256`;
        } else if (cat === "places" && q.country_code) {
          image_url = `https://flagcdn.com/w320/${q.country_code.toLowerCase()}.png`;
        }
        return { ...q, image_url };
      });

      return { error: null, questions: enriched };
    } catch (e) {
      console.error("generateRamailoQuestions error", e);
      return { error: "Failed to generate questions", questions: [] };
    }
  });
