import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuizPlayer, type QuizQuestion } from "@/components/QuizPlayer";
import { BrainLoader } from "@/components/BrainLoader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, ArrowRight, Sparkles, BookOpen } from "lucide-react";
import { consumeCachedQuiz, fetchSeenQuestions, hashQuestion, prefetchQuiz, recordSeen, PRIMARY_MODEL, SECONDARY_MODEL } from "@/lib/quiz-cache";
import { fetchSubjects, fetchCurriculumContext } from "@/lib/curriculum.functions";
import { countryByCode, gradeLabel } from "@/lib/locale-options";

export const Route = createFileRoute("/random")({ component: () => <AppShell><Random /></AppShell> });

type Subject = { name: string; emoji: string; blurb: string };

const SUBJECT_GRADIENTS = [
  "from-pink-500 to-rose-500",
  "from-violet-500 to-fuchsia-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-indigo-500 to-purple-500",
  "from-red-500 to-pink-500",
  "from-lime-500 to-green-500",
];

function Random() {
  const { user } = useAuth();
  const { profile, loading: profLoading } = useProfile();
  const nav = useNavigate();

  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [endPrompt, setEndPrompt] = useState<null | { score: number; total: number }>(null);

  const country = profile?.country ?? null;
  const grade = profile?.grade ?? null;
  const countryMeta = countryByCode(country);

  // Load subjects when profile available
  useEffect(() => {
    if (!country || !grade) return;
    setLoadingSubjects(true);
    fetchSubjects({ data: { country, grade } }).then((r) => {
      setSubjects(r.subjects ?? []);
      setLoadingSubjects(false);
    }).catch(() => setLoadingSubjects(false));
  }, [country, grade]);

  const newNonce = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const startSubject = async (subjectName: string) => {
    if (!user || !country || !grade) return;
    setActiveSubject(subjectName);
    setLoading(true);
    setError(null);
    setEndPrompt(null);
    setQuestions([]);
    try {
      const { context } = await fetchCurriculumContext({ data: { country, grade, subject: subjectName } });
      const seen = await fetchSeenQuestions(user.id);
      const nonce = newNonce();
      const key = `random:${user.id}:${subjectName}:${nonce}`;
      const promise = prefetchQuiz(key, {
        topic: subjectName, difficulty: "intermediate", count: 5,
        avoid: seen.slice(-150), nonce, model: PRIMARY_MODEL,
        curriculumContext: context, country, grade, subject: subjectName,
      });
      consumeCachedQuiz(key);

      // Prewarm next round
      (async () => {
        const nonce2 = newNonce();
        const nextKey = `random:${user.id}:${subjectName}:next`;
        prefetchQuiz(nextKey, {
          topic: subjectName, difficulty: "intermediate", count: 5,
          avoid: seen.slice(-150), nonce: nonce2, model: SECONDARY_MODEL,
          curriculumContext: context, country, grade, subject: subjectName,
        });
      })();

      const res = await promise;
      if (res.error) { setError(res.error); setLoading(false); return; }
      const seenSet = new Set(seen);
      const filtered = res.questions.filter((q) => !seenSet.has(hashQuestion(q.question)));
      setQuestions(filtered.length >= 3 ? filtered : res.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };

  const finish = async (score: number) => {
    if (user && activeSubject) {
      await recordSeen(user.id, questions, "random");
      await supabase.from("quiz_attempts").insert({
        user_id: user.id, mode: "random", difficulty: "intermediate",
        score, total: questions.length, topic: activeSubject,
      });
    }
    setEndPrompt({ score, total: questions.length });
  };

  const playAgain = async () => {
    if (!activeSubject) return;
    setEndPrompt(null);
    await startSubject(activeSubject);
  };

  const backToSubjects = () => {
    setActiveSubject(null);
    setQuestions([]);
    setEndPrompt(null);
    setError(null);
  };

  // ---------- Render ----------
  if (profLoading) return <BrainLoader label="Loading your profile" />;

  if (!country || !grade) {
    return (
      <div className="space-y-6 max-w-lg mx-auto animate-slide-in">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/" })} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Home
        </Button>
        <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-card border border-border">
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Set your country & class</h2>
          <p className="text-muted-foreground mb-5">We tailor every question to your real syllabus.</p>
          <Button onClick={() => nav({ to: "/profile" })} className="rounded-full bg-gradient-hero">
            Go to profile
          </Button>
        </div>
      </div>
    );
  }

  if (activeSubject) {
    if (endPrompt) {
      return (
        <div className="space-y-6 max-w-lg mx-auto">
          <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-glow animate-slide-in">
            <h2 className="text-3xl font-bold mb-2">Nice run!</h2>
            <p className="text-5xl font-bold text-gradient mb-2">{endPrompt.score} / {endPrompt.total}</p>
            <p className="text-muted-foreground mb-6">{activeSubject} · fresh round?</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={playAgain} className="rounded-full bg-gradient-hero font-bold">
                Continue <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={backToSubjects} className="rounded-full">All subjects</Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={backToSubjects} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Subjects
        </Button>
        <QuizPlayer
          loading={loading}
          error={error}
          questions={questions}
          title={`${activeSubject} · ${gradeLabel(grade)}`}
          onFinish={finish}
          onRetry={() => startSubject(activeSubject)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-slide-in">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/" })} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Home
      </Button>

      <div className="rounded-3xl bg-gradient-hero p-6 text-white shadow-glow text-center relative overflow-hidden">
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <BookOpen className="h-10 w-10 mx-auto mb-2 relative" />
        <p className="text-white/80 text-sm relative">{countryMeta?.flag} {countryMeta?.name} · {gradeLabel(grade)}</p>
        <p className="text-3xl font-bold relative">Pick a subject</p>
        <p className="text-white/80 text-xs mt-2 relative">Questions taken from your real syllabus</p>
      </div>

      {loadingSubjects ? (
        <BrainLoader label="Loading your subjects" />
      ) : !subjects || subjects.length === 0 ? (
        <div className="rounded-3xl bg-card p-8 text-center border border-border">
          <p className="text-muted-foreground">We couldn't fetch subjects right now. Try again.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {subjects.map((s, i) => (
            <button
              key={s.name}
              onClick={() => startSubject(s.name)}
              className={`group rounded-3xl p-5 text-left text-white bg-gradient-to-br ${SUBJECT_GRADIENTS[i % SUBJECT_GRADIENTS.length]} shadow-card hover:shadow-glow hover:-translate-y-1 transition-all animate-fade-in`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">{s.emoji}</div>
              <h3 className="font-bold text-lg leading-tight">{s.name}</h3>
              <p className="text-white/85 text-xs mt-1 line-clamp-2">{s.blurb}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
