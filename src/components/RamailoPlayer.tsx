import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, X, ArrowRight, Sparkles, Zap, BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import type { QuizQuestion } from "@/components/QuizPlayer";
import { BrainLoader } from "@/components/BrainLoader";
import { explainQuestion } from "@/server/quiz.functions";

const BG_GRADIENTS = [
  "from-pink-400 via-rose-400 to-orange-400",
  "from-violet-500 via-purple-500 to-fuchsia-500",
  "from-sky-400 via-cyan-400 to-blue-500",
  "from-emerald-400 via-teal-400 to-green-500",
  "from-amber-400 via-orange-400 to-red-400",
  "from-indigo-500 via-blue-500 to-cyan-400",
];

const OPTION_COLORS = [
  "from-rose-500 to-pink-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-violet-500 to-indigo-500",
];

/**
 * Playful, animated quiz player for Ramailo mode.
 * - One/two-word answers shown as bright bubble buttons
 * - Big animated emoji hero with confetti-like ping rings on correct
 * - Tap-to-reveal explanation
 */
export function RamailoPlayer({
  loading,
  error,
  questions,
  onFinish,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  questions: QuizQuestion[];
  onFinish: (score: number) => void;
  onRetry: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => { setIdx(0); setPicked(null); setScore(0); setDone(false); setStreak(0); setSummary(""); }, [questions]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (moreOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [moreOpen]);

  if (loading) return <BrainLoader />;

  if (error) {
    return (
      <div className="rounded-3xl bg-card p-8 text-center shadow-card">
        <p className="text-destructive font-medium mb-4">{error}</p>
        <Button onClick={onRetry} className="rounded-full">Try again</Button>
      </div>
    );
  }

  if (questions.length === 0) {
    return <p className="text-muted-foreground text-center">No questions yet.</p>;
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="rounded-3xl bg-gradient-card p-8 text-center shadow-glow animate-slide-in">
        <div className="text-7xl mb-3 animate-bounce">{pct >= 80 ? "🏆" : pct >= 50 ? "🎉" : "💪"}</div>
        <h2 className="text-3xl font-bold mb-2">Ramailo done!</h2>
        <p className="text-5xl font-bold text-gradient mb-2">{score} / {questions.length}</p>
        <p className="text-muted-foreground mb-6">{pct}% correct</p>
        <Button onClick={() => onFinish(score)} className="rounded-full bg-gradient-hero">
          Continue
        </Button>
      </div>
    );
  }

  const q = questions[idx];
  const answered = picked !== null;
  const grad = BG_GRADIENTS[idx % BG_GRADIENTS.length];
  const isRight = answered && picked === q.correct_index;

  return (
    <div className="space-y-5 animate-slide-in max-w-2xl mx-auto">
      <div>
        <div className="flex items-center justify-between mb-2 text-sm gap-2">
          <span className="font-bold text-primary inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Ramailo
          </span>
          <div className="flex items-center gap-3">
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-xs font-bold animate-scale-in">
                <Zap className="h-3 w-3 fill-amber-500" /> {streak} streak
              </span>
            )}
            <span className="text-muted-foreground">{idx + 1} / {questions.length}</span>
          </div>
        </div>
        <Progress value={((idx + (answered ? 1 : 0)) / questions.length) * 100} className="h-2" />
      </div>

      {/* Hero card — simpler, image-first when provided */}
      <div className={cn(
        "relative rounded-[2rem] bg-gradient-to-br p-6 sm:p-8 text-white shadow-card overflow-hidden",
        grad
      )}>
        <div className="absolute -top-10 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col items-center text-center">
          {q.image_url ? (
            <div className="relative bg-white rounded-2xl p-4 shadow-soft animate-scale-in">
              <img
                key={idx}
                src={q.image_url}
                alt=""
                className="h-32 w-32 sm:h-40 sm:w-40 object-contain"
                loading="eager"
              />
              {isRight && (
                <span className="absolute inset-0 rounded-2xl ring-4 ring-white/60 animate-ping" />
              )}
            </div>
          ) : (
            <div
              key={idx + (answered ? "-a" : "-q")}
              className="text-6xl sm:text-7xl select-none animate-scale-in drop-shadow"
              aria-hidden
            >
              {answered ? (isRight ? "🎉" : "💭") : (q.emoji || "❓")}
            </div>
          )}
          <h2 className="mt-4 text-xl sm:text-2xl font-extrabold leading-tight drop-shadow">
            {q.question}
          </h2>
        </div>
      </div>

      {/* Option bubbles */}
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct_index;
          const isPicked = i === picked;
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => {
                setPicked(i);
                if (i === q.correct_index) {
                  setScore((s) => s + 1);
                  setStreak((s) => s + 1);
                } else {
                  setStreak(0);
                }
              }}
              className={cn(
                "group relative h-20 sm:h-24 rounded-2xl px-3 py-2 font-extrabold text-base sm:text-lg transition-all overflow-hidden border-2",
                !answered && `bg-gradient-to-br ${color} text-white border-white/20 shadow-card hover:scale-[1.04] active:scale-95 hover:shadow-glow`,
                answered && isCorrect && "bg-success text-white border-success scale-[1.02]",
                answered && isPicked && !isCorrect && "bg-destructive/90 text-white border-destructive",
                answered && !isPicked && !isCorrect && "bg-muted text-muted-foreground border-border opacity-50",
              )}
            >
              <span className="relative z-10 line-clamp-2 leading-tight">{opt}</span>
              {answered && isCorrect && (
                <Check className="absolute top-1.5 right-1.5 h-5 w-5 z-10" />
              )}
              {answered && isPicked && !isCorrect && (
                <X className="absolute top-1.5 right-1.5 h-5 w-5 z-10" />
              )}
              {!answered && (
                <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={cn(
          "p-4 rounded-2xl text-sm animate-slide-in border-2",
          isRight ? "bg-success/10 border-success/30 text-foreground" : "bg-muted border-border",
        )}>
          <span className="font-bold">{isRight ? "✅ Correct! " : "💡 "}</span>
          {q.explanation}
        </div>
      )}

      {answered && (
        <Button
          onClick={() => {
            if (idx + 1 >= questions.length) setDone(true);
            else { setIdx(idx + 1); setPicked(null); }
          }}
          className="w-full h-12 rounded-2xl bg-gradient-hero font-bold text-base"
        >
          {idx + 1 >= questions.length ? "See results 🎊" : "Next"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
