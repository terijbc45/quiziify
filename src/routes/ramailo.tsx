import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { type QuizQuestion } from "@/components/QuizPlayer";
import { RamailoPlayer } from "@/components/RamailoPlayer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Sparkles, Globe2, Pizza, Building2, BookMarked, Languages } from "lucide-react";
import { fetchSeenQuestions, hashQuestion, recordSeen, consumeCachedQuiz, prefetchRamailo, PRIMARY_MODEL, SECONDARY_MODEL } from "@/lib/quiz-cache";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ramailo")({ component: () => <AppShell><Ramailo /></AppShell> });

type Cat = "random" | "logo" | "places" | "food_animals";
type Lang = "en" | "ne";

const CATEGORIES: Array<{ id: Cat; label: string; emoji: string; icon: typeof Globe2; gradient: string; desc: string }> = [
  { id: "random", label: "G.K", emoji: "📚", icon: BookMarked, gradient: "from-violet-500 to-fuchsia-500", desc: "Lok Sewa Aayog style general knowledge" },
  { id: "logo", label: "Logo", emoji: "🏷️", icon: Building2, gradient: "from-sky-500 to-cyan-500", desc: "Guess the brand from its logo" },
  { id: "places", label: "Places", emoji: "🌍", icon: Globe2, gradient: "from-emerald-500 to-teal-500", desc: "Flags, monuments & famous spots" },
  { id: "food_animals", label: "Foods & Animals", emoji: "🍕", icon: Pizza, gradient: "from-amber-500 to-orange-500", desc: "Tasty bites and wild creatures" },
];

function Ramailo() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [category, setCategory] = useState<Cat | null>(null);
  const [language, setLanguage] = useState<Lang>("en");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endPrompt, setEndPrompt] = useState<null | { score: number; total: number }>(null);

  const newNonce = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const MIN_QUESTIONS = 10;

  const load = async (cat: Cat, lang: Lang) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setQuestions([]);
    try {
      const includeLatest = cat === "random" && Math.random() < 0.6;
      const langKey = cat === "random" ? `:${lang}` : "";
      const scope = `ramailo:${cat}${langKey}`;
      const recent = getRecentQuestionTexts(user.id, scope);
      const seen = await fetchSeenQuestions(user.id);
      const seenSet = new Set(seen);

      const nextKey = `${scope}:${user.id}:next`;
      const baseParams = {
        count: 14, avoid: recent.slice(-140), includeLatest, category: cat, language: lang,
      };

      const fetchBatch = (model: string) =>
        prefetchRamailo(`${scope}:${user.id}:${newNonce()}`, { ...baseParams, nonce: newNonce(), model });

      // Try the pre-warmed batch first, but only if it's actually usable.
      let batch = await consumeCachedQuiz(nextKey);
      const usable = (r?: { error: string | null; questions: QuizQuestion[] }) =>
        !!r && !r.error && r.questions.length >= MIN_QUESTIONS;

      if (!usable(batch)) batch = await fetchBatch(PRIMARY_MODEL);
      if (!usable(batch)) batch = await fetchBatch(SECONDARY_MODEL);

      if (!batch || (batch.questions.length === 0)) {
        setError(batch?.error ?? "Couldn't prepare questions. Please try again.");
        setLoading(false);
        return;
      }

      // Drop anything already played; only fall back to the raw batch if that leaves too few.
      const recentSet = new Set(recent.map((t) => t.trim()));
      const fresh = batch.questions.filter(
        (q) => !seenSet.has(hashQuestion(q.question)) && !recentSet.has(q.question.trim()),
      );
      const qs = (fresh.length >= MIN_QUESTIONS ? fresh : batch.questions) as QuizQuestion[];

      setQuestions(qs);
      recordRecentQuestionTexts(user.id, scope, qs.map((q) => q.question));

      // Warm the next round in the background using the updated avoid list.
      prefetchRamailo(nextKey, {
        ...baseParams,
        avoid: getRecentQuestionTexts(user.id, scope).slice(-140),
        nonce: newNonce(),
        model: PRIMARY_MODEL,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const pick = (cat: Cat) => { setCategory(cat); setEndPrompt(null); load(cat, language); };

  const switchLanguage = (lang: Lang) => {
    if (lang === language) return;
    setLanguage(lang);
    if (category === "random") load("random", lang);
  };

  const finish = async (score: number) => {
    if (user) {
      await recordSeen(user.id, questions, "ramailo");
      await supabase.from("quiz_attempts").insert({
        user_id: user.id, mode: "ramailo", difficulty: "easy", score, total: questions.length, topic: category ?? "ramailo",
      });
    }
    setEndPrompt({ score, total: questions.length });
  };

  const playAgain = async () => { if (category) { setEndPrompt(null); await load(category, language); } };


  // ----- Picker view -----
  if (!category) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-slide-in">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/" })} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Home
        </Button>
        <div className="rounded-3xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 p-6 text-white shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5" />
            <h1 className="text-2xl font-bold">Ramailo</h1>
          </div>
          <p className="text-white/90 text-sm">Pick a category and play. Quick, fun & sharp.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c.id)}
              className={`group relative rounded-3xl p-5 text-left text-white bg-gradient-to-br ${c.gradient} shadow-card hover:scale-[1.03] active:scale-95 transition-transform overflow-hidden`}
            >
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
              <div className="text-4xl mb-2">{c.emoji}</div>
              <div className="font-bold text-lg leading-tight">{c.label}</div>
              <div className="text-xs text-white/85 mt-1 leading-snug">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ----- Quiz view -----
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => { setCategory(null); setQuestions([]); setEndPrompt(null); }} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Categories
        </Button>
        {category === "random" && (
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border shadow-soft">
            <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
            {(["en", "ne"] as const).map((l) => (
              <button
                key={l}
                onClick={() => switchLanguage(l)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold transition-all",
                  language === l ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={language === l}
              >
                {l === "en" ? "English" : "नेपाली"}
              </button>
            ))}
          </div>
        )}
      </div>
      {endPrompt ? (
        <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-glow animate-slide-in max-w-lg mx-auto">
          <h2 className="text-3xl font-bold mb-2">Ramailo done! 🎉</h2>
          <p className="text-5xl font-bold text-gradient mb-2">{endPrompt.score} / {endPrompt.total}</p>
          <p className="text-muted-foreground mb-6">Want another fresh round?</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={playAgain} className="rounded-full bg-gradient-hero font-bold">Continue</Button>
            <Button variant="outline" onClick={() => setCategory(null)} className="rounded-full">Pick category</Button>
          </div>
        </div>
      ) : (
        <RamailoPlayer
          loading={loading}
          error={error}
          questions={questions}
          onFinish={finish}
          onRetry={() => load(category, language)}
        />
      )}
    </div>
  );
}
