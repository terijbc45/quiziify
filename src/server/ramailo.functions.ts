import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchLatestSnippets } from "./firecrawl.server";
import { fetchLogoImage, fetchPlaceImage, fetchFoodAnimalImage } from "./firecrawl-images.server";

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
const Language = z.enum(["en", "ne"]);

const Input = z.object({
  count: z.number().min(1).max(10).default(5),
  avoid: z.array(z.string()).max(200).optional(),
  nonce: z.string().max(64).optional(),
  includeLatest: z.boolean().optional(),
  category: Categories.optional(),
  model: z.string().max(80).optional(),
  language: Language.optional(),
});

function categoryPrompt(cat: z.infer<typeof Categories>, lang: z.infer<typeof Language>): string {
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
Options must be short (1-3 words). Mix continents. Include at least one Nepal-related question per batch (e.g. Pashupatinath, Mount Everest, Lumbini, Pokhara, Boudhanath).`;
    case "food_animals":
      return `Generate fun trivia mixing famous foods and animals from around the world: dishes, fruits, drinks, mammals, birds, sea creatures, insects. E.g. "Which country is sushi from?", "Fastest land animal?", "What animal is a 'joey'?", "Pizza margherita originated in?". Include at least one Nepali food (momo, dal bhat, sel roti, gundruk, yomari, dhindo) or Nepali wildlife (one-horned rhino, red panda, snow leopard, danphe). Use a vivid emoji per question.`;
    case "random":
    default:
      return `Generate Nepal Lok Sewa Aayog (Public Service Commission) style general-knowledge MCQs. ${lang === "ne" ? "Write EVERYTHING (question, options, explanation) in Nepali (Devanagari script)." : "Write everything in clear English."} Strictly cover the SAME bucket-set Lok Sewa uses for samanya gyan (general knowledge):
- Nepal: history (Lichchhavi, Malla, Shah, Rana, Panchayat, 2046 Jana Andolan, 2062/63), geography (provinces, rivers, mountains, districts), constitution & government (current constitution 2072, fundamental rights, federalism), economy & current affairs (recent budget, GDP, exports, latest appointments)
- Nepali culture, festivals, literature, art, music, national symbols
- World: geography, history, organizations (UN, SAARC, BRICS, WTO, IMF), capitals, currencies
- Science (physics, chemistry, biology, IT basics), sports, environment
- Latest current affairs (last 12 months) Nepal & world
DELIBERATELY rotate across these buckets — never two questions from the same bucket per batch. Keep difficulty similar to Lok Sewa Aayog samanya gyan / IQ section. Use a vivid emoji per question.`;
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

      // Resolve image_url server-side based on category — prefer real internet images via Firecrawl.
      const enriched = await Promise.all(parsed.questions.map(async (q) => {
        let image_url: string | null = q.image_url ?? null;
        try {
          if (cat === "logo" && q.subject) {
            image_url = await fetchLogoImage(q.subject, q.domain);
          } else if (cat === "places") {
            if (q.country_code) {
              image_url = `https://flagcdn.com/w320/${q.country_code.toLowerCase()}.png`;
            } else if (q.subject) {
              image_url = await fetchPlaceImage(q.subject);
            }
          } else if (cat === "food_animals" && q.subject) {
            image_url = await fetchFoodAnimalImage(q.subject);
          }
        } catch { /* graceful */ }
        return { ...q, image_url: image_url ?? "" };
      }));

      // Drop image-required questions with no resolved image (logo/places) so player never shows broken thumbs.
      const final = enriched.filter((q) => (cat === "logo" || cat === "places") ? !!q.image_url : true);
      return { error: null, questions: final.length > 0 ? final : enriched };
    } catch (e) {
      console.error("generateRamailoQuestions error", e);
      return { error: "Failed to generate questions", questions: [] };
    }
  });
