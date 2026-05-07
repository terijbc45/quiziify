import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuizPlayer, type QuizQuestion } from "@/components/QuizPlayer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Sparkles, Lock, Check, Trophy, ArrowRight } from "lucide-react";
import {
  consumeCachedQuiz,
  fetchSeenQuestions,
  prefetchQuiz,
  recordSeen,
  hashQuestion,
} from "@/lib/quiz-cache";

export const Route = createFileRoute("/level")({ component: () => <AppShell><LevelMode /></AppShell> });

function difficultyForLevel(lvl: number): "easy" | "intermediate" | "hard" {
  if (lvl <= 5) return "easy";
  if (lvl <= 15) return "intermediate";
  return "hard";
}

function LevelMode() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [currentLevel, setCurrentLevel] = useState(1);
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [postQuiz, setPostQuiz] = useState<null | { passed: boolean; score: number; level: number }>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("level_progress").select("current_level").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setCurrentLevel(data.current_level); });
  }, [user]);

  // Prefetch the user's current unlocked level for instant start
  useEffect(() => {
    if (!user || !currentLevel) return;
    const key = `level:${user.id}:${currentLevel}`;
    fetchSeenQuestions(user.id).then((seen) => {
      const avoid = seen.slice(-100);
      prefetchQuiz(key, { topic: "any", difficulty: difficultyForLevel(currentLevel), count: 5, level: currentLevel, avoid, includeLatest: Math.random() < 0.4 });
    });
  }, [user, currentLevel]);

  const startLevel = async (lvl: number) => {
    if (!user) return;
    setActiveLevel(lvl);
    setLoading(true);
    setError(null);
    setPostQuiz(null);

    const key = `level:${user.id}:${lvl}`;
    let promise = consumeCachedQuiz(key);
    if (!promise) {
      const seen = await fetchSeenQuestions(user.id);
      promise = prefetchQuiz(key, {
        topic: "any",
        difficulty: difficultyForLevel(lvl),
        count: 5,
        level: lvl,
        avoid: seen.slice(-100),
      });
      consumeCachedQuiz(key);
    }
    const res = await promise;
    if (res.error) { setError(res.error); setLoading(false); return; }

    // Local de-dupe against any seen this session
    const seenSet = new Set((await fetchSeenQuestions(user.id)));
    const filtered = res.questions.filter((q) => !seenSet.has(hashQuestion(q.question)));
    const final = filtered.length >= 3 ? filtered : res.questions;
    setQuestions(final);
    setLoading(false);
  };

  const finish = async (score: number) => {
    if (!user || activeLevel === null) return;
    // Always unlock the next level after attempting (per user request)
    const passed = true;
    const newLevel = activeLevel === currentLevel ? activeLevel + 1 : currentLevel;

    await recordSeen(user.id, questions, "level", activeLevel);

    await supabase.from("quiz_attempts").insert({
      user_id: user.id, mode: "level", level: activeLevel, difficulty: difficultyForLevel(activeLevel), score, total: questions.length, topic: "any",
    });

    if (newLevel !== currentLevel) {
      const cur = (await supabase.from("level_progress").select("total_score").eq("user_id", user.id).single()).data!.total_score;
      await supabase.from("level_progress").update({
        current_level: newLevel,
        total_score: cur + score,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      setCurrentLevel(newLevel);
    } else {
      const cur = (await supabase.from("level_progress").select("total_score").eq("user_id", user.id).single()).data!.total_score;
      await supabase.from("level_progress").update({ total_score: cur + score }).eq("user_id", user.id);
    }

    setPostQuiz({ passed, score, level: activeLevel });

    // Prefetch next level in background
    if (passed) {
      const nextL = activeLevel + 1;
      const seen = await fetchSeenQuestions(user.id);
      prefetchQuiz(`level:${user.id}:${nextL}`, {
        topic: "any", difficulty: difficultyForLevel(nextL), count: 5, level: nextL, avoid: seen.slice(-100),
      });
    }
  };

  const backToGrid = () => {
    setActiveLevel(null);
    setQuestions([]);
    setPostQuiz(null);
  };

  // ---------- Render ----------
  if (activeLevel === null) {
    return <LevelGrid currentLevel={currentLevel} onStart={startLevel} onBack={() => nav({ to: "/play" })} />;
  }

  if (postQuiz) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-glow animate-slide-in">
          <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-1">Level {postQuiz.level} done!</h2>
          <p className="text-5xl font-bold text-gradient mb-2">{postQuiz.score} / 5</p>
          <p className="text-muted-foreground mb-6">
            Level {postQuiz.level + 1} is unlocked. Ready to level up?
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={() => startLevel(postQuiz.level + 1)} className="rounded-full bg-gradient-hero font-bold">
              Start Level {postQuiz.level + 1} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={backToGrid} className="rounded-full">All levels</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={backToGrid} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Levels
      </Button>
      <QuizPlayer
        loading={loading}
        error={error}
        questions={questions}
        title={`Level ${activeLevel} · ${difficultyForLevel(activeLevel)}`}
        onFinish={finish}
        onRetry={() => startLevel(activeLevel)}
      />
    </div>
  );
}

function LevelGrid({
  currentLevel,
  onStart,
  onBack,
}: {
  currentLevel: number;
  onStart: (lvl: number) => void;
  onBack: () => void;
}) {
  // Show levels in chunks of 30, including current and ones already unlocked
  const total = Math.max(30, currentLevel + 9);
  const levels = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="space-y-6 animate-slide-in max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <div className="rounded-3xl bg-gradient-hero p-6 text-white shadow-glow text-center">
        <Sparkles className="h-10 w-10 mx-auto mb-2" />
        <p className="text-white/80 text-sm">Currently on</p>
        <p className="text-5xl font-bold">Level {currentLevel}</p>
        <p className="text-white/80 text-xs mt-2">Score 4/5 to unlock the next level</p>
      </div>

      <h2 className="font-bold text-lg">All levels</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {levels.map((lvl) => {
          const locked = lvl > currentLevel;
          const cleared = lvl < currentLevel;
          const active = lvl === currentLevel;
          return (
            <button
              key={lvl}
              disabled={locked}
              onClick={() => onStart(lvl)}
              className={[
                "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center font-bold transition-all p-2",
                locked && "border-border bg-muted/40 text-muted-foreground cursor-not-allowed",
                cleared && "border-success/40 bg-success/10 text-success-foreground hover:bg-success/20",
                active && "border-primary bg-gradient-hero text-white shadow-glow scale-105",
                !locked && "hover:scale-105",
              ].filter(Boolean).join(" ")}
            >
              {locked ? <Lock className="h-4 w-4" /> : cleared ? <Check className="h-4 w-4 mb-0.5" /> : <Sparkles className="h-4 w-4 mb-0.5" />}
              <span className="text-xs opacity-80">Level</span>
              <span className="text-lg leading-none">{lvl}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Difficulty rises with each level. Questions never repeat.
      </p>
    </div>
  );
}
