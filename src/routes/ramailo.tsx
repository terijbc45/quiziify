import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuizPlayer, type QuizQuestion } from "@/components/QuizPlayer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Sparkles } from "lucide-react";
import { fetchSeenQuestions, hashQuestion, recordSeen } from "@/lib/quiz-cache";
import { generateRamailoQuestions } from "@/server/ramailo.functions";

export const Route = createFileRoute("/ramailo")({ component: () => <AppShell><Ramailo /></AppShell> });

function Ramailo() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endPrompt, setEndPrompt] = useState<null | { score: number; total: number }>(null);

  const newNonce = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setQuestions([]);
    try {
      const seen = await fetchSeenQuestions(user.id);
      const includeLatest = Math.random() < 0.5;
      const r = await generateRamailoQuestions({
        data: { count: 5, avoid: seen.slice(-150), nonce: newNonce(), includeLatest },
      });
      if (r.error) { setError(r.error); setLoading(false); return; }
      const seenSet = new Set(seen);
      const filtered = r.questions.filter((q) => !seenSet.has(hashQuestion(q.question)));
      const qs = (filtered.length >= 3 ? filtered : r.questions).map((q) => ({
        ...q, author: null, image_url: null,
      })) as QuizQuestion[];
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user?.id]);

  const finish = async (score: number) => {
    if (user) {
      await recordSeen(user.id, questions, "ramailo");
      await supabase.from("quiz_attempts").insert({
        user_id: user.id, mode: "ramailo", difficulty: "easy", score, total: questions.length, topic: "ramailo",
      });
    }
    setEndPrompt({ score, total: questions.length });
  };

  const playAgain = async () => { setEndPrompt(null); await load(); };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/" })} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Home
      </Button>
      {endPrompt ? (
        <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-glow animate-slide-in max-w-lg mx-auto">
          <h2 className="text-3xl font-bold mb-2">Ramailo done! 🎉</h2>
          <p className="text-5xl font-bold text-gradient mb-2">{endPrompt.score} / {endPrompt.total}</p>
          <p className="text-muted-foreground mb-6">Want another fresh round?</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={playAgain} className="rounded-full bg-gradient-hero font-bold">Continue</Button>
            <Button variant="outline" onClick={() => nav({ to: "/" })} className="rounded-full">Go to Home</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Ramailo · simple, fun general-knowledge questions</span>
          </div>
          <QuizPlayer
            loading={loading}
            error={error}
            questions={questions}
            title="Ramailo · easy"
            onFinish={finish}
            onRetry={load}
          />
        </>
      )}
    </div>
  );
}
