import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuizPlayer, type QuizQuestion } from "@/components/QuizPlayer";
import { BrainLoader } from "@/components/BrainLoader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, Timer, BookOpen } from "lucide-react";
import { fetchSeenQuestions, hashQuestion, recordSeen, PRIMARY_MODEL } from "@/lib/quiz-cache";
import { generateQuestions } from "@/lib/quiz.functions";
import { fetchSubjects, fetchChapters, fetchCurriculumContext } from "@/lib/curriculum.functions";
import { countryByCode, gradeLabel } from "@/lib/locale-options";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/random")({ component: () => <AppShell><Test /></AppShell> });

type Subject = { name: string; emoji: string; blurb: string; image_url?: string | null };
type Chapter = { name: string; emoji: string; summary: string; image_url?: string | null };
type Difficulty = "default" | "easy" | "intermediate" | "hard";

const TOTAL_QUESTIONS = 100;
const DEFAULT_TIMER_MIN = 60;

function Test() {
  const { user } = useAuth();
  const { profile, loading: profLoading } = useProfile();
  const nav = useNavigate();

  const country = profile?.country ?? null;
  const grade = profile?.grade ?? null;
  const countryMeta = countryByCode(country);

  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [subject, setSubject] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const [chapterUpto, setChapterUpto] = useState<number | null>(null); // 1-based index
  const [difficulty, setDifficulty] = useState<Difficulty>("default");
  const [timerMin, setTimerMin] = useState<number>(DEFAULT_TIMER_MIN);

  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [endPrompt, setEndPrompt] = useState<null | { score: number; total: number }>(null);

  // Load subjects
  useEffect(() => {
    if (!country || !grade) return;
    setLoadingSubjects(true);
    fetchSubjects({ data: { country, grade } })
      .then((r: { subjects?: Subject[] }) => { setSubjects(r.subjects ?? []); })
      .catch(() => {})
      .finally(() => setLoadingSubjects(false));
  }, [country, grade]);

  // Load chapters when subject chosen
  useEffect(() => {
    if (!subject || !country || !grade) return;
    setLoadingChapters(true);
    fetchChapters({ data: { country, grade, subject } })
      .then((r: { chapters?: Chapter[] }) => setChapters(r.chapters ?? []))
      .catch(() => {})
      .finally(() => setLoadingChapters(false));
  }, [subject, country, grade]);

  const startTest = async () => {
    if (!user || !country || !grade || !subject || !chapterUpto) return;
    setStarted(true);
    setLoading(true);
    setError(null);
    setQuestions([]);
    try {
      const seen = await fetchSeenQuestions(user.id);
      const scope = chapters.slice(0, chapterUpto).map((c) => c.name);
      const chapterScope = `Chapters 1 to ${chapterUpto}: ${scope.join(", ")}`;
      const { context } = await fetchCurriculumContext({ data: { country, grade, subject } });
      const diffPrompt = difficulty === "default"
        ? "Mix difficulty: ~33% easy, ~34% intermediate, ~33% hard."
        : `All questions at ${difficulty} difficulty.`;

      // Generate 100 questions in parallel batches of 10
      const batchSize = 10;
      const batches = Array.from({ length: TOTAL_QUESTIONS / batchSize }, (_, i) => i);
      const all: QuizQuestion[] = [];
      const results = await Promise.all(
        batches.map((b) =>
          generateQuestions({
            data: {
              topic: `${subject} (${chapterScope}). ${diffPrompt}`,
              difficulty: difficulty === "default" ? "intermediate" : difficulty,
              count: batchSize,
              avoid: seen.slice(-150),
              nonce: `test-${b}-${Date.now()}`,
              model: PRIMARY_MODEL,
              curriculumContext: context,
              country, grade, subject,
            },
          }).catch(() => ({ error: "batch-failed", questions: [] as QuizQuestion[] })),
        ),
      );
      const seenHashes = new Set<string>();
      for (const r of results) {
        for (const q of (r.questions ?? [])) {
          const h = hashQuestion(q.question);
          if (seenHashes.has(h)) continue;
          seenHashes.add(h);
          all.push(q);
        }
      }
      if (all.length === 0) {
        setError("Couldn't generate test questions right now. Try again.");
      } else {
        setQuestions(all.slice(0, TOTAL_QUESTIONS));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start test");
    } finally {
      setLoading(false);
    }
  };

  const finish = async (score: number) => {
    if (user && subject) {
      await recordSeen(user.id, questions, "test");
      await supabase.from("quiz_attempts").insert({
        user_id: user.id, mode: "test",
        difficulty: difficulty === "default" ? "intermediate" : difficulty,
        score, total: questions.length,
        topic: `${subject} (up to Ch.${chapterUpto})`,
      });
    }
    setEndPrompt({ score, total: questions.length });
  };

  const resetAll = () => {
    setStarted(false); setQuestions([]); setEndPrompt(null); setError(null);
    setChapterUpto(null); setChapters([]); setSubject(null);
  };

  if (profLoading) return <BrainLoader label="Loading your profile" />;

  if (!country || !grade) {
    return (
      <div className="space-y-6 max-w-lg mx-auto animate-slide-in">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/play" })} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="rounded-3xl bg-card p-8 text-center border border-border">
          <Timer className="h-12 w-12 mx-auto mb-3 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Set your class first</h2>
          <p className="text-muted-foreground mb-5">Tests follow your real syllabus.</p>
          <Button onClick={() => nav({ to: "/profile" })} className="rounded-full bg-gradient-hero">Go to profile</Button>
        </div>
      </div>
    );
  }

  // Running test
  if (started) {
    if (endPrompt) {
      return (
        <div className="space-y-6 max-w-lg mx-auto">
          <div className="rounded-3xl bg-card p-8 text-center shadow-glow animate-slide-in border border-border">
            <Timer className="h-12 w-12 mx-auto mb-3 text-primary" />
            <h2 className="text-3xl font-bold mb-1">Test complete!</h2>
            <p className="text-muted-foreground mb-3">{subject} · up to Ch.{chapterUpto}</p>
            <p className="text-5xl font-bold text-gradient mb-6">{endPrompt.score} / {endPrompt.total}</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={resetAll} variant="outline" className="rounded-full">New test</Button>
              <Button onClick={() => nav({ to: "/play" })} className="rounded-full bg-gradient-hero">Back to modes</Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={resetAll} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Exit test
        </Button>
        <QuizPlayer
          loading={loading}
          error={error}
          questions={questions}
          title={`Test · ${subject} · up to Ch.${chapterUpto}`}
          onFinish={finish}
          onRetry={startTest}
          hideDeepDive
          timerSeconds={Math.max(1, timerMin) * 60}
        />
      </div>
    );
  }

  // Step 1: subject grid
  if (!subject) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-slide-in">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/play" })} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="rounded-3xl bg-gradient-hero p-6 text-white shadow-glow text-center relative overflow-hidden">
          <Timer className="h-10 w-10 mx-auto mb-2" />
          <p className="text-white/80 text-sm">{countryMeta?.flag} {countryMeta?.name} · {gradeLabel(grade)}</p>
          <p className="text-3xl font-bold">Test Mode</p>
          <p className="text-white/80 text-xs mt-2">100 questions · set your own timer</p>
        </div>
        {loadingSubjects ? (
          <BrainLoader label="Loading subjects" />
        ) : !subjects || subjects.length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-center border border-border">
            <p className="text-muted-foreground">Couldn't load subjects. Try again.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {subjects.map((s, i) => (
              <button key={s.name} onClick={() => setSubject(s.name)}
                className="group rounded-2xl bg-white border-2 border-border hover:border-primary shadow-card hover:shadow-glow hover:-translate-y-1 transition-all animate-fade-in overflow-hidden text-left"
                style={{ animationDelay: `${i * 30}ms` }}>
                <div className="aspect-square bg-muted overflow-hidden">
                  {s.image_url ? (
                    <img src={s.image_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">{s.emoji}</div>
                  )}
                </div>
                <div className="p-3"><h3 className="font-semibold text-foreground text-center leading-tight">{s.name}</h3></div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2: chapter range + difficulty
  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-slide-in">
      <Button variant="ghost" size="sm" onClick={() => { setSubject(null); setChapterUpto(null); }} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Subjects
      </Button>
      <div className="rounded-3xl bg-card border border-border p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <BookOpen className="h-4 w-4" /> {subject} · {gradeLabel(grade)}
        </div>
        <h2 className="text-2xl font-bold mb-1">Configure your test</h2>
        <p className="text-muted-foreground text-sm mb-5">
          Pick the chapter you've studied up to — questions from <b>chapter 1 through your chosen chapter</b> will be asked.
        </p>

        {loadingChapters ? <BrainLoader label="Loading chapters" /> : (
          <>
            <p className="font-semibold text-sm mb-2">Chapter range</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6 max-h-60 overflow-y-auto">
              {chapters.map((c, i) => {
                const n = i + 1;
                const selected = chapterUpto === n;
                return (
                  <button key={c.name} onClick={() => setChapterUpto(n)}
                    className={cn(
                      "text-left rounded-xl border-2 p-3 transition-all text-xs",
                      selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-white hover:border-primary/50 text-foreground",
                    )}>
                    <div className="font-bold text-[10px] text-muted-foreground uppercase">Ch {n}</div>
                    <div className="font-semibold leading-tight line-clamp-2">{c.name}</div>
                  </button>
                );
              })}
            </div>
            {chapters.length === 0 && (
              <p className="text-sm text-muted-foreground mb-6">No chapters available yet.</p>
            )}

            <p className="font-semibold text-sm mb-2">Difficulty</p>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {(["default", "easy", "intermediate", "hard"] as Difficulty[]).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2 text-xs font-bold capitalize transition-all",
                    difficulty === d ? "border-primary bg-primary/10 text-primary" : "border-border bg-white hover:border-primary/50 text-foreground",
                  )}>
                  {d}
                </button>
              ))}
            </div>

            <p className="font-semibold text-sm mb-2">Timer (minutes)</p>
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <button key={m} onClick={() => setTimerMin(m)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2 text-xs font-bold transition-all",
                    timerMin === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-white hover:border-primary/50 text-foreground",
                  )}>
                  {m} min
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={300}
                value={timerMin}
                onChange={(e) => setTimerMin(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
                className="w-24 rounded-xl border-2 border-border bg-white px-3 py-2 text-xs font-bold text-foreground focus:border-primary outline-none"
                aria-label="Custom timer in minutes"
              />
            </div>

            <Button onClick={startTest} disabled={!chapterUpto}
              className="w-full h-12 rounded-2xl bg-gradient-hero font-bold text-base">
              <Timer className="h-4 w-4 mr-2" /> Start 100-Q Test ({timerMin} min)
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
