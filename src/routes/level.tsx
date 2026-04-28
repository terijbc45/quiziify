import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuizPlayer, type QuizQuestion } from "@/components/QuizPlayer";
import { Button } from "@/components/ui/button";
import { generateQuestions } from "@/server/quiz.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/level")({ component: () => <AppShell><LevelMode /></AppShell> });

function difficultyForLevel(lvl: number): "easy" | "intermediate" | "hard" {
  if (lvl <= 5) return "easy";
  if (lvl <= 15) return "intermediate";
  return "hard";
}

function LevelMode() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [level, setLevel] = useState(1);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("level_progress").select("current_level").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setLevel(data.current_level); });
  }, [user]);

  const start = async () => {
    setStarted(true);
    setLoading(true);
    setError(null);
    const diff = difficultyForLevel(level);
    const res = await generateQuestions({ data: { topic: "any", difficulty: diff, count: 5, level } });
    if (res.error) { setError(res.error); setLoading(false); return; }
    setQuestions(res.questions.map((q) => ({ ...q, author: null })));
    setLoading(false);
  };

  const finish = async (score: number) => {
    if (!user) return;
    const passed = score >= 4; // need 4/5 to advance
    const newLevel = passed ? level + 1 : level;
    await supabase.from("quiz_attempts").insert({
      user_id: user.id, mode: "level", level, difficulty: difficultyForLevel(level), score, total: questions.length, topic: "any",
    });
    await supabase.from("level_progress").update({
      current_level: newLevel,
      total_score: (await supabase.from("level_progress").select("total_score").eq("user_id", user.id).single()).data!.total_score + score,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
    if (passed) toast.success(`Level ${level} cleared! Onto Level ${newLevel}.`);
    else toast.info(`Need 4/5 to advance. Try Level ${level} again!`);
    nav({ to: "/profile" });
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/" })} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Home
      </Button>

      {!started ? (
        <div className="rounded-3xl bg-gradient-hero p-8 text-white shadow-glow max-w-lg mx-auto text-center animate-slide-in">
          <Sparkles className="h-12 w-12 mx-auto mb-4" />
          <p className="text-white/80 font-medium">Current level</p>
          <p className="text-7xl font-bold mb-2">{level}</p>
          <p className="text-white/90 mb-6">Difficulty: <span className="font-semibold capitalize">{difficultyForLevel(level)}</span> · Score 4/5 or more to advance</p>
          <Button onClick={start} size="lg" className="rounded-full bg-white text-primary hover:bg-white/90 font-bold shadow-glow">
            Start Level {level}
          </Button>
        </div>
      ) : (
        <QuizPlayer
          loading={loading}
          error={error}
          questions={questions}
          title={`Level ${level} · ${difficultyForLevel(level)}`}
          onFinish={finish}
          onRetry={start}
        />
      )}
    </div>
  );
}
