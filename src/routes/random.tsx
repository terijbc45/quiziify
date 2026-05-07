import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuizPlayer, type QuizQuestion } from "@/components/QuizPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft } from "lucide-react";

import { consumeCachedQuiz, fetchSeenQuestions, hashQuestion, prefetchQuiz, recordSeen } from "@/lib/quiz-cache";

export const Route = createFileRoute("/random")({ component: () => <AppShell><Random /></AppShell> });

function Random() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [topic, setTopic] = useState("any");
  const [diff, setDiff] = useState<"easy" | "intermediate" | "hard">("intermediate");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [endPrompt, setEndPrompt] = useState<null | { score: number; total: number }>(null);
  const [round, setRound] = useState(0);

  const newNonce = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // Prefetch when settings change (initial only)
  useEffect(() => {
    if (!user || started) return;
    const nonce = newNonce();
    const key = `random:${user.id}:${topic}:${diff}:${nonce}`;
    fetchSeenQuestions(user.id).then((seen) => {
      prefetchQuiz(key, { topic, difficulty: diff, count: 5, avoid: seen.slice(-150), nonce, includeLatest: Math.random() < 0.4 });
      // stash the key so start() picks it up
      (window as any).__randomPrefetchKey = key;
    });
  }, [user, topic, diff, started]);

  const start = async () => {
    if (!user) return;
    setStarted(true);
    setLoading(true);
    setError(null);
    try {
      const seen = await fetchSeenQuestions(user.id);
      let promise: ReturnType<typeof prefetchQuiz> | undefined;
      const stashed = (window as any).__randomPrefetchKey as string | undefined;
      if (stashed) {
        promise = consumeCachedQuiz(stashed);
        (window as any).__randomPrefetchKey = undefined;
      }
      if (!promise) {
        const nonce = newNonce();
        const key = `random:${user.id}:${topic}:${diff}:${nonce}`;
        promise = prefetchQuiz(key, { topic, difficulty: diff, count: 5, avoid: seen.slice(-150), nonce, includeLatest: Math.random() < 0.4 });
        consumeCachedQuiz(key);
      }
      const aiRes = await promise;
      if (aiRes.error) { setError(aiRes.error); setLoading(false); return; }

      const seenSet = new Set(seen);
      const filtered = aiRes.questions.filter((q) => !seenSet.has(hashQuestion(q.question)));
      let qs: QuizQuestion[] = (filtered.length >= 3 ? filtered : aiRes.questions);

      // 30% chance to inject a user-created question if any exist
      const { data: userQs } = await supabase
        .from("user_quizzes")
        .select("question, options, correct_index, explanation, image_url, author_id")
        .eq("difficulty", diff)
        .limit(20);

      if (userQs && userQs.length > 0 && Math.random() < 0.3) {
        const fresh = userQs.filter((u) => !seenSet.has(hashQuestion(u.question)));
        const pool = fresh.length > 0 ? fresh : userQs;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", pick.author_id).maybeSingle();
        const userQ: QuizQuestion = {
          question: pick.question,
          options: pick.options as string[],
          correct_index: pick.correct_index,
          explanation: pick.explanation ?? "",
          author: prof?.display_name ?? "A user",
          image_url: pick.image_url ?? null,
        };
        qs.splice(Math.floor(Math.random() * qs.length), 0, userQ);
      }
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const finish = async (score: number) => {
    if (user) {
      await recordSeen(user.id, questions, "random");
      await supabase.from("quiz_attempts").insert({
        user_id: user.id, mode: "random", difficulty: diff, score, total: questions.length, topic,
      });
    }
    setEndPrompt({ score, total: questions.length });
  };

  const playAgain = async () => {
    setEndPrompt(null);
    setQuestions([]);
    setRound((r) => r + 1);
    // Force a brand new generation with fresh nonce + freshly fetched seen list
    if (user) {
      const seen = await fetchSeenQuestions(user.id);
      const nonce = newNonce();
      const key = `random:${user.id}:${topic}:${diff}:${nonce}`;
      prefetchQuiz(key, { topic, difficulty: diff, count: 5, avoid: seen.slice(-150), nonce, includeLatest: Math.random() < 0.4 });
      (window as any).__randomPrefetchKey = key;
    }
    await start();
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/" })} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Home
      </Button>

      {!started ? (
        <div className="rounded-3xl bg-card p-7 shadow-card border border-border max-w-lg mx-auto animate-slide-in">
          <h1 className="text-3xl font-bold mb-1">Random quiz</h1>
          <p className="text-muted-foreground mb-6">5 fresh AI-generated questions — no repeats.</p>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="any, history, biology…" maxLength={80} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "intermediate", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiff(d)}
                    className={`h-11 rounded-xl text-sm font-semibold capitalize transition-all border-2 ${
                      diff === d ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
                    }`}
                  >{d}</button>
                ))}
              </div>
            </div>
            <Button onClick={start} className="w-full h-12 rounded-2xl bg-gradient-hero font-semibold">
              Start quiz
            </Button>
          </div>
        </div>
      ) : endPrompt ? (
        <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-glow animate-slide-in max-w-lg mx-auto">
          <h2 className="text-3xl font-bold mb-2">Nice run!</h2>
          <p className="text-5xl font-bold text-gradient mb-2">{endPrompt.score} / {endPrompt.total}</p>
          <p className="text-muted-foreground mb-6">Keep going with another fresh round?</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={playAgain} className="rounded-full bg-gradient-hero font-bold">
              Continue
            </Button>
            <Button variant="outline" onClick={() => nav({ to: "/" })} className="rounded-full">
              Go to Home
            </Button>
          </div>
        </div>
      ) : (
        <QuizPlayer
          loading={loading}
          error={error}
          questions={questions}
          title={`Random · ${diff}`}
          onFinish={finish}
          onRetry={start}
        />
      )}
    </div>
  );
}
