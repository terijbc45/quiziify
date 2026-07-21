import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchLatestSnippets } from "../server/firecrawl.server";
import { fetchLogoImage, fetchPlaceImage, fetchFoodAnimalImage } from "../server/firecrawl-images.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
type RamailoQuestion = z.infer<typeof Question>;

const Categories = z.enum(["random", "logo", "places", "food_animals"]);
const Language = z.enum(["en", "ne"]);

const Input = z.object({
  count: z.number().min(1).max(20).default(10),
  avoid: z.array(z.string()).max(400).optional(),
  nonce: z.string().max(64).optional(),
  includeLatest: z.boolean().optional(),
  category: Categories.optional(),
  model: z.string().max(80).optional(),
  language: Language.optional(),
});
type RamailoInput = z.infer<typeof Input>;

function fallbackQuestions(cat: z.infer<typeof Categories>, lang: z.infer<typeof Language>): RamailoQuestion[] {
  if (cat === "logo") {
    return [
      { question: "Which company's logo is this?", options: ["Apple", "Nike", "Toyota", "Samsung"], correct_index: 0, explanation: "Apple — global tech company.", emoji: "🏷️", subject: "Apple", domain: "apple.com" },
      { question: "Which company's logo is this?", options: ["Nike", "Adidas", "Puma", "Reebok"], correct_index: 0, explanation: "Nike — the swoosh.", emoji: "👟", subject: "Nike", domain: "nike.com" },
      { question: "Which company's logo is this?", options: ["Google", "Yahoo", "Bing", "Baidu"], correct_index: 0, explanation: "Google — search giant.", emoji: "🔎", subject: "Google", domain: "google.com" },
      { question: "Which brand's logo is this?", options: ["McDonald's", "KFC", "Burger King", "Subway"], correct_index: 0, explanation: "McDonald's — golden arches.", emoji: "🍔", subject: "McDonalds", domain: "mcdonalds.com" },
      { question: "Which company's logo is this?", options: ["Toyota", "Honda", "Ford", "BMW"], correct_index: 0, explanation: "Toyota — Japanese carmaker.", emoji: "🚗", subject: "Toyota", domain: "toyota.com" },
      { question: "Which brand's logo is this?", options: ["Coca-Cola", "Pepsi", "Sprite", "Fanta"], correct_index: 0, explanation: "Coca-Cola — classic cursive.", emoji: "🥤", subject: "Coca-Cola", domain: "coca-cola.com" },
      { question: "Which company's logo is this?", options: ["Samsung", "Sony", "LG", "Panasonic"], correct_index: 0, explanation: "Samsung — Korean tech.", emoji: "📱", subject: "Samsung", domain: "samsung.com" },
      { question: "Which company's logo is this?", options: ["Adidas", "Nike", "Puma", "Fila"], correct_index: 0, explanation: "Adidas — three stripes.", emoji: "👟", subject: "Adidas", domain: "adidas.com" },
      { question: "Which company's logo is this?", options: ["BMW", "Audi", "Mercedes", "VW"], correct_index: 0, explanation: "BMW — roundel.", emoji: "🚙", subject: "BMW", domain: "bmw.com" },
      { question: "Which app's logo is this?", options: ["Spotify", "Apple Music", "Deezer", "Tidal"], correct_index: 0, explanation: "Spotify — music streaming.", emoji: "🎧", subject: "Spotify", domain: "spotify.com" },
      { question: "Which app's logo is this?", options: ["Netflix", "Prime", "Hulu", "Disney+"], correct_index: 0, explanation: "Netflix — streaming.", emoji: "🎬", subject: "Netflix", domain: "netflix.com" },
      { question: "Which brand's logo is this?", options: ["IKEA", "H&M", "Zara", "Uniqlo"], correct_index: 0, explanation: "IKEA — Swedish furniture.", emoji: "🛋️", subject: "IKEA", domain: "ikea.com" },
    ];
  }
  if (cat === "places") {
    return [
      { question: "Which country's flag is this?", options: ["Nepal", "Japan", "Bhutan", "India"], correct_index: 0, explanation: "Nepal — only non-rectangular flag.", emoji: "🇳🇵", subject: "Nepal", country_code: "np" },
      { question: "Which country's flag is this?", options: ["Japan", "China", "Korea", "Vietnam"], correct_index: 0, explanation: "Japan — red sun on white.", emoji: "🇯🇵", subject: "Japan", country_code: "jp" },
      { question: "Which country's flag is this?", options: ["Brazil", "Argentina", "Mexico", "Chile"], correct_index: 0, explanation: "Brazil — green with yellow rhombus.", emoji: "🇧🇷", subject: "Brazil", country_code: "br" },
      { question: "Which country's flag is this?", options: ["France", "Italy", "Ireland", "Belgium"], correct_index: 0, explanation: "France — blue, white, red tricolour.", emoji: "🇫🇷", subject: "France", country_code: "fr" },
      { question: "Where is Mount Everest located?", options: ["Nepal", "Bhutan", "Tibet", "India"], correct_index: 0, explanation: "Everest lies on the Nepal–China border.", emoji: "🏔️", subject: "Mount Everest" },
      { question: "Where is the Eiffel Tower?", options: ["Paris", "Rome", "London", "Berlin"], correct_index: 0, explanation: "Eiffel Tower is in Paris, France.", emoji: "🗼", subject: "Eiffel Tower" },
      { question: "Where is Pashupatinath Temple?", options: ["Kathmandu", "Pokhara", "Janakpur", "Lalitpur"], correct_index: 0, explanation: "On the banks of the Bagmati in Kathmandu.", emoji: "🛕", subject: "Pashupatinath" },
      { question: "Which country's flag is this?", options: ["USA", "UK", "Australia", "Canada"], correct_index: 0, explanation: "Stars and stripes — USA.", emoji: "🇺🇸", subject: "United States", country_code: "us" },
      { question: "Where is the Colosseum?", options: ["Rome", "Athens", "Cairo", "Istanbul"], correct_index: 0, explanation: "The Colosseum is in Rome, Italy.", emoji: "🏛️", subject: "Colosseum" },
      { question: "Where is Lumbini located?", options: ["Nepal", "India", "Sri Lanka", "Bhutan"], correct_index: 0, explanation: "Lumbini, Nepal — birthplace of Buddha.", emoji: "☸️", subject: "Lumbini" },
      { question: "Which country's flag is this?", options: ["Germany", "Belgium", "Spain", "Italy"], correct_index: 0, explanation: "Black, red, gold — Germany.", emoji: "🇩🇪", subject: "Germany", country_code: "de" },
      { question: "Where is the Taj Mahal?", options: ["Agra", "Delhi", "Jaipur", "Mumbai"], correct_index: 0, explanation: "Agra, India.", emoji: "🕌", subject: "Taj Mahal" },
    ];
  }
  if (cat === "food_animals") {
    return [
      { question: "Which Nepali food is fermented leafy greens?", options: ["Gundruk", "Momo", "Yomari", "Dhindo"], correct_index: 0, explanation: "Gundruk — fermented greens.", emoji: "🥬" },
      { question: "Fastest land animal?", options: ["Cheetah", "Lion", "Horse", "Tiger"], correct_index: 0, explanation: "Cheetah — up to 110 km/h.", emoji: "🐆" },
      { question: "Which country is sushi from?", options: ["Japan", "China", "Korea", "Thailand"], correct_index: 0, explanation: "Sushi originated in Japan.", emoji: "🍣" },
      { question: "A baby kangaroo is called a?", options: ["Joey", "Cub", "Calf", "Kit"], correct_index: 0, explanation: "Baby kangaroo = joey.", emoji: "🦘" },
      { question: "Pizza Margherita originated in?", options: ["Italy", "France", "Greece", "Spain"], correct_index: 0, explanation: "Naples, Italy.", emoji: "🍕" },
      { question: "National bird of Nepal?", options: ["Danphe", "Peacock", "Eagle", "Crane"], correct_index: 0, explanation: "Danphe (Himalayan Monal).", emoji: "🐦" },
      { question: "Largest mammal on Earth?", options: ["Blue whale", "Elephant", "Giraffe", "Hippo"], correct_index: 0, explanation: "Blue whale.", emoji: "🐋" },
      { question: "Momo is a popular dish of?", options: ["Nepal", "Italy", "Mexico", "France"], correct_index: 0, explanation: "Momo — Nepali dumplings.", emoji: "🥟" },
      { question: "Which animal is the 'ship of the desert'?", options: ["Camel", "Horse", "Donkey", "Ox"], correct_index: 0, explanation: "Camel.", emoji: "🐫" },
      { question: "Sel roti is a traditional food of?", options: ["Nepal", "India", "Bhutan", "Tibet"], correct_index: 0, explanation: "Nepali ring-shaped rice bread.", emoji: "🍩" },
      { question: "Red panda is native to?", options: ["Himalayas", "Amazon", "Sahara", "Alps"], correct_index: 0, explanation: "Eastern Himalayas.", emoji: "🐼" },
      { question: "Which fruit is called 'King of Fruits'?", options: ["Mango", "Apple", "Banana", "Grape"], correct_index: 0, explanation: "Mango.", emoji: "🥭" },
    ];
  }
  return lang === "ne"
    ? [
        { question: "नेपालको वर्तमान संविधान कहिले जारी भयो?", options: ["२०७२", "२०४७", "२०६३", "२०१५"], correct_index: 0, explanation: "२०७२ असोज ३ गते।", emoji: "📜" },
        { question: "नेपालको राष्ट्रिय फूल कुन हो?", options: ["लालीगुराँस", "कमल", "सयपत्री", "गुलाब"], correct_index: 0, explanation: "लालीगुराँस।", emoji: "🌺" },
        { question: "सगरमाथाको उचाइ कति हो?", options: ["८८४८.८६ मि", "८६११ मि", "८५८६ मि", "८१६७ मि"], correct_index: 0, explanation: "८८४८.८६ मिटर।", emoji: "🏔️" },
        { question: "नेपालमा कति प्रदेश छन्?", options: ["७", "५", "६", "८"], correct_index: 0, explanation: "सात प्रदेश।", emoji: "🗺️" },
        { question: "नेपालको राष्ट्रिय पंक्षी?", options: ["डाँफे", "मयुर", "चील", "सारस"], correct_index: 0, explanation: "डाँफे।", emoji: "🐦" },
        { question: "बुद्धको जन्मस्थल?", options: ["लुम्बिनी", "कपिलवस्तु", "पाटन", "जनकपुर"], correct_index: 0, explanation: "लुम्बिनी।", emoji: "☸️" },
        { question: "नेपालको सबैभन्दा लामो नदी?", options: ["कर्णाली", "कोशी", "गण्डकी", "बागमती"], correct_index: 0, explanation: "कर्णाली।", emoji: "🌊" },
        { question: "नेपालको राजधानी?", options: ["काठमाडौं", "पोखरा", "ललितपुर", "भक्तपुर"], correct_index: 0, explanation: "काठमाडौं।", emoji: "🏙️" },
        { question: "SAARC को स्थापना वर्ष?", options: ["१९८५", "१९९०", "१९८०", "१९९५"], correct_index: 0, explanation: "१९८५ ढाकामा।", emoji: "🌏" },
        { question: "नेपालको राष्ट्रिय खेल?", options: ["दण्डी बियो", "फुटबल", "क्रिकेट", "भलिबल"], correct_index: 3, explanation: "भलिबल (२०७४ देखि)।", emoji: "🏐" },
      ]
    : [
        { question: "When was Nepal's current constitution promulgated?", options: ["2015", "1990", "2006", "1959"], correct_index: 0, explanation: "2015 AD (2072 BS).", emoji: "📜" },
        { question: "Height of Mount Everest?", options: ["8848.86 m", "8611 m", "8586 m", "8167 m"], correct_index: 0, explanation: "8848.86 metres.", emoji: "🏔️" },
        { question: "National flower of Nepal?", options: ["Rhododendron", "Lotus", "Marigold", "Rose"], correct_index: 0, explanation: "Laligurans.", emoji: "🌺" },
        { question: "How many provinces does Nepal have?", options: ["7", "5", "6", "8"], correct_index: 0, explanation: "Seven provinces.", emoji: "🗺️" },
        { question: "National bird of Nepal?", options: ["Danphe", "Peacock", "Eagle", "Crane"], correct_index: 0, explanation: "Danphe (Himalayan Monal).", emoji: "🐦" },
        { question: "Birthplace of Gautam Buddha?", options: ["Lumbini", "Kapilvastu", "Patan", "Janakpur"], correct_index: 0, explanation: "Lumbini, Nepal.", emoji: "☸️" },
        { question: "Longest river of Nepal?", options: ["Karnali", "Koshi", "Gandaki", "Bagmati"], correct_index: 0, explanation: "Karnali.", emoji: "🌊" },
        { question: "Capital of Nepal?", options: ["Kathmandu", "Pokhara", "Lalitpur", "Bhaktapur"], correct_index: 0, explanation: "Kathmandu.", emoji: "🏙️" },
        { question: "SAARC was founded in?", options: ["1985", "1990", "1980", "1995"], correct_index: 0, explanation: "1985 in Dhaka.", emoji: "🌏" },
        { question: "National game of Nepal?", options: ["Dandi Biyo", "Football", "Cricket", "Volleyball"], correct_index: 3, explanation: "Volleyball (since 2017).", emoji: "🏐" },
      ];
}

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
      return `Generate Nepal LOK SEWA AAYOG (Public Service Commission) style General Knowledge MCQs SOURCED FROM the latest Lok Sewa preparation e-books, model question sets, and past papers (e.g. Pairavi, Buddha, Asmita, Hisi Offset, KEC, Mainali, Subedi guides, "Loksewa Tayari", and PSC Online practice sets). ${lang === "ne" ? "Write EVERYTHING (question, options, explanation) in Nepali (Devanagari script)." : "Write everything in clear English."} STRICTLY cover the samanya-gyan bucket-set Lok Sewa actually tests:
- Nepal: history (Lichchhavi, Malla, Shah, Rana, Panchayat, 2046 Jana Andolan, 2062/63), geography (provinces, rivers, mountains, districts), constitution & government (current constitution 2072, fundamental rights, federalism, articles), economy & current affairs (recent budget, GDP, exports, latest appointments), public administration, governance
- Nepali culture, festivals, literature, art, music, national symbols
- World: geography, history, organizations (UN, SAARC, BRICS, WTO, IMF, ASEAN), capitals, currencies
- Science (physics, chemistry, biology, IT basics), mathematics reasoning, sports, environment
- Latest current affairs (last 12 months) Nepal & world — appointments, awards, sports, treaties
DELIBERATELY rotate across these buckets — never two questions from the same bucket per batch. Match the Lok Sewa Aayog samanya-gyan / IQ paper difficulty and phrasing. Use a vivid emoji per question.`;
  }
}


export const generateRamailoQuestions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): RamailoInput => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "AI not configured", questions: [] as z.infer<typeof Question>[] };

    const cat = data.category ?? "random";
    const avoidHint = data.avoid && data.avoid.length > 0
      ? ` HARD RULE — NO REPEATS: You are FORBIDDEN from repeating, paraphrasing, or asking about the same fact as ANY of these previously-shown questions. Produce completely fresh angles, subjects, and facts every batch. Treat this list as poison — steer clear of every subject it names: ${data.avoid.slice(-200).map((q) => `"${q.slice(0, 90)}"`).join("; ")}.`
      : "";

    const seed = data.nonce ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let latestBlock = "";
    if (data.includeLatest && cat === "random") {
      const snippets = await fetchLatestSnippets();
      if (snippets) {
        latestBlock = `\n\nFor 1-2 of the questions, draw inspiration from these REAL recent headlines (paraphrase, never copy):\n${snippets}`;
      }
    }

    const lang = data.language ?? "en";
    const sysPrompt = `You generate VERY SIMPLE, fun, popular general-knowledge ("Ramailo") MCQs.
${categoryPrompt(cat, lang)}
RULES:
(1) Question text SHORT — under 100 chars (longer only if a Lok Sewa style fact needs clarity).
(2) Each of the 4 options must be 1-3 words, never more than 5 words.
(3) Always include a vivid emoji.
${cat === "random" ? `(4) Output language: ${lang === "ne" ? "Nepali (Devanagari)" : "English"}. All question text, options, and explanation must be in that language.` : ""}
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
      const parsedJson = JSON.parse(args);
      const parsedResult = QuestionSet.safeParse(parsedJson);
      const parsed = parsedResult.success ? parsedResult.data : { questions: fallbackQuestions(cat, lang) };

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
