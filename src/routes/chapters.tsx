import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuizPlayer, type QuizQuestion } from "@/components/QuizPlayer";
import { BrainLoader } from "@/components/BrainLoader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, ArrowRight, BookOpen, Check, RotateCcw, Trophy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { consumeCachedQuiz, fetchSeenQuestions, hashQuestion, prefetchQuiz, recordSeen, PRIMARY_MODEL, SECONDARY_MODEL } from "@/lib/quiz-cache";
import { fetchSubjects, fetchChapters } from "@/server/curriculum.functions";
import { countryByCode, gradeLabel } from "@/lib/locale-options";

export const Route = createFileRoute("/chapters")({ component: () => <AppShell><Chapters /></AppShell> });

type Subject = { name: string; emoji: string; blurb: string };
type Chapter = { name: string; emoji: string; summary: string };

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

function Chapters() {
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
  const [chapterCtx, setChapterCtx] = useState<string>("");
  const [loadingChapters, setLoadingChapters] = useState(false);

  const [progress, setProgress] = useState<Set<string>>(new Set());

  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [postQuiz, setPostQuiz] = useState<null | { score: number; total: number; chapter: string }>(null);

  // Load subjects
  useEffect(() => {
    if (!country || !grade) return;
    setLoadingSubjects(true);
    fetchSubjects({ data: { country, grade } }).then((r) => {
      setSubjects(r.subjects ?? []);
      setLoadingSubjects(false);
    }).catch(() => setLoadingSubjects(false));
  }, [country, grade]);

  // Load progress
  useEffect(() => {
    if (!user || !country || !grade) return;
    supabase.from("chapter_progress").select("subject,chapter").eq("user_id", user.id).eq("country", country).eq("grade", grade)
      .then(({ data }) => {
        if (data) setProgress(new Set(data.map((r) => `${r.subject}::${r.chapter}`)));
      });
  }, [user, country, grade]);

  // Load chapters when subject picked
  useEffect(() => {
    if (!subject || !country || !grade) return;
    setLoadingChapters(true);
    fetchChapters({ data: { country, grade, subject } }).then((r) => {
      setChapters(r.chapters ?? []);
      setChapterCtx((r as { context?: string }).context ?? "");
      setLoadingChapters(false);
    }).catch(() => setLoadingChapters(false));
  }, [subject, country, grade]);

  const newNonce = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const startChapter = async (chapterName: string) => {
    if (!user || !country || !grade || !subject) return;
    setActiveChapter(chapterName);
    setLoading(true);
    setError(null);
    setPostQuiz(null);
    setQuestions([]);
    try {
      const seen = await fetchSeenQuestions(user.id);
      const nonce = newNonce();
      const key = `chapter:${user.id}:${subject}:${chapterName}:${nonce}`;
      const promise = prefetchQuiz(key, {
        topic: `${subject} — ${chapterName}`, difficulty: "intermediate", count: 10,
        avoid: seen.slice(-150), nonce, model: PRIMARY_MODEL,
        curriculumContext: chapterCtx, country, grade, subject, chapter: chapterName,
      });
      consumeCachedQuiz(key);

      // Prewarm next chapter
      const idx = chapters.findIndex((c) => c.name === chapterName);
      const next = chapters[idx + 1];
      if (next) {
        const nonce2 = newNonce();
        prefetchQuiz(`chapter:${user.id}:${subject}:${next.name}:next`, {
          topic: `${subject} — ${next.name}`, difficulty: "intermediate", count: 10,
          avoid: seen.slice(-150), nonce: nonce2, model: SECONDARY_MODEL,
          curriculumContext: chapterCtx, country, grade, subject, chapter: next.name,
        });
      }

      const res = await promise;
      if (res.error) { setError(res.error); setLoading(false); return; }
      const seenSet = new Set(seen);
      const filtered = res.questions.filter((q) => !seenSet.has(hashQuestion(q.question)));
      setQuestions(filtered.length >= 5 ? filtered : res.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };

  const finish = async (score: number) => {
    if (!user || !country || !grade || !subject || !activeChapter) return;
    await recordSeen(user.id, questions, "chapter");
    await supabase.from("quiz_attempts").insert({
      user_id: user.id, mode: "chapter", difficulty: "intermediate",
      score, total: questions.length, topic: `${subject} / ${activeChapter}`,
    });
    // Upsert chapter_progress (best_score)
    const { data: existing } = await supabase.from("chapter_progress").select("id,best_score")
      .eq("user_id", user.id).eq("country", country).eq("grade", grade)
      .eq("subject", subject).eq("chapter", activeChapter).maybeSingle();
    if (existing) {
      if (score > existing.best_score) {
        await supabase.from("chapter_progress").update({ best_score: score, completed_at: new Date().toISOString() }).eq("id", existing.id);
      }
    } else {
      await supabase.from("chapter_progress").insert({
        user_id: user.id, country, grade, subject, chapter: activeChapter, best_score: score,
      });
    }
    setProgress((p) => new Set([...p, `${subject}::${activeChapter}`]));
    setPostQuiz({ score, total: questions.length, chapter: activeChapter });
  };

  const resetProgress = async () => {
    if (!user || !country || !grade) return;
    if (!confirm("Reset all chapter progress? You can re-learn from scratch.")) return;
    await supabase.from("chapter_progress").delete().eq("user_id", user.id).eq("country", country).eq("grade", grade);
    setProgress(new Set());
    toast.success("Progress reset");
  };

  const backToChapters = () => { setActiveChapter(null); setQuestions([]); setPostQuiz(null); setError(null); };
  const backToSubjects = () => { setSubject(null); setChapters([]); setChapterCtx(""); backToChapters(); };

  // ---------- Render ----------
  if (profLoading) return <BrainLoader label="Loading your profile" />;

  if (!country || !grade) {
    return (
      <div className="space-y-6 max-w-lg mx-auto animate-slide-in">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/play" })} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-card border border-border">
          <BookOpen className="h-12 w-12 mx-auto mb-3 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Set your country & class</h2>
          <p className="text-muted-foreground mb-5">Chapters follow your real syllabus.</p>
          <Button onClick={() => nav({ to: "/profile" })} className="rounded-full bg-gradient-hero">
            Go to profile
          </Button>
        </div>
      </div>
    );
  }

  // Chapter quiz view
  if (activeChapter) {
    if (postQuiz) {
      const idx = chapters.findIndex((c) => c.name === postQuiz.chapter);
      const next = chapters[idx + 1];
      return (
        <div className="space-y-6 max-w-lg mx-auto">
          <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-glow animate-slide-in">
            <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-1">Chapter complete!</h2>
            <p className="text-lg text-muted-foreground mb-3">{postQuiz.chapter}</p>
            <p className="text-5xl font-bold text-gradient mb-6">{postQuiz.score} / {postQuiz.total}</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => startChapter(postQuiz.chapter)} variant="outline" className="rounded-full">
                <RotateCcw className="h-4 w-4 mr-1" /> Restart
              </Button>
              {next && (
                <Button onClick={() => startChapter(next.name)} className="rounded-full bg-gradient-hero font-bold">
                  Next: {next.name} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" onClick={backToChapters} className="rounded-full">All chapters</Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={backToChapters} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Chapters
        </Button>
        <QuizPlayer
          loading={loading}
          error={error}
          questions={questions}
          title={`${subject} · ${activeChapter}`}
          onFinish={finish}
          onRetry={() => startChapter(activeChapter)}
        />
      </div>
    );
  }

  // Chapter grid view
  if (subject) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-slide-in">
        <Button variant="ghost" size="sm" onClick={backToSubjects} className="rounded-full">
          <ArrowLeft className="h-4 w-4 mr-1" /> Subjects
        </Button>
        <div className="rounded-3xl bg-gradient-hero p-6 text-white shadow-glow text-center relative overflow-hidden">
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <p className="text-white/80 text-sm relative">{countryMeta?.flag} {gradeLabel(grade)} · {subject}</p>
          <p className="text-3xl font-bold relative">Chapters</p>
          <p className="text-white/80 text-xs mt-2 relative">Tap a chapter to start its quiz</p>
        </div>

        {loadingChapters ? (
          <BrainLoader label="Loading chapters" />
        ) : chapters.length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-center border border-border">
            <p className="text-muted-foreground">No chapters available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chapters.map((c, i) => {
              const done = progress.has(`${subject}::${c.name}`);
              return (
                <button
                  key={c.name}
                  onClick={() => startChapter(c.name)}
                  className={`group relative rounded-2xl p-4 text-left border-2 transition-all hover:-translate-y-0.5 animate-fade-in ${
                    done ? "border-success/40 bg-success/5" : "border-border bg-card hover:border-primary"
                  }`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{c.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Ch. {i + 1}</span>
                        {done && <Check className="h-3.5 w-3.5 text-success" />}
                      </div>
                      <h3 className="font-bold leading-tight">{c.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.summary}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Subject grid view
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-slide-in">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/play" })} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <div className="rounded-3xl bg-gradient-hero p-6 text-white shadow-glow text-center relative overflow-hidden">
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <Sparkles className="h-10 w-10 mx-auto mb-2 relative" />
        <p className="text-white/80 text-sm relative">{countryMeta?.flag} {countryMeta?.name} · {gradeLabel(grade)}</p>
        <p className="text-3xl font-bold relative">Your subjects</p>
        <p className="text-white/80 text-xs mt-2 relative">Pick one to see its chapters</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Subjects</h2>
        {progress.size > 0 && (
          <Button variant="outline" size="sm" onClick={resetProgress} className="rounded-full">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset progress
          </Button>
        )}
      </div>

      {loadingSubjects ? (
        <BrainLoader label="Loading subjects" />
      ) : !subjects || subjects.length === 0 ? (
        <div className="rounded-3xl bg-card p-8 text-center border border-border">
          <p className="text-muted-foreground">Couldn't fetch your subjects right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {subjects.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setSubject(s.name)}
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
