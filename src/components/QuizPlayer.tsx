import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, X, Loader2, ArrowRight, Trophy, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { explainQuestion } from "@/server/quiz.functions";

export type QuizQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  author?: string | null;
  image_url?: string | null;
  emoji?: string | null;
};

// Bolder gradients to match the playful look across all three modes
const GRADIENTS = [
  "from-pink-500 via-rose-500 to-orange-400",
  "from-violet-500 via-purple-500 to-fuchsia-500",
  "from-sky-500 via-cyan-500 to-blue-500",
  "from-emerald-500 via-teal-500 to-green-500",
  "from-amber-500 via-orange-500 to-red-400",
  "from-indigo-500 via-blue-500 to-cyan-500",
];

export function QuizPlayer({
  loading,
  error,
  questions,
  title,
  onFinish,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  questions: QuizQuestion[];
  title: string;
  onFinish: (score: number) => void;
  onRetry: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => { setIdx(0); setPicked(null); setScore(0); setDone(false); }, [questions]);

  // Lock body scroll while the Deep Dive overlay is open so only the overlay scrolls
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (moreOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [moreOpen]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-pulse" />
          <div className="relative text-6xl animate-bounce">🧠</div>
        </div>
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="font-bold text-lg">Preparing Questions</p>
          <span className="inline-flex gap-0.5">
            <span className="animate-bounce [animation-delay:0ms]">.</span>
            <span className="animate-bounce [animation-delay:150ms]">.</span>
            <span className="animate-bounce [animation-delay:300ms]">.</span>
          </span>
        </div>
      </div>
    );
  }

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
        <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-bold mb-2">Quiz complete!</h2>
        <p className="text-5xl font-bold text-gradient mb-2">{score} / {questions.length}</p>
        <p className="text-muted-foreground mb-6">{pct}% correct</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => onFinish(score)} className="rounded-full bg-gradient-hero">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const answered = picked !== null;
  const grad = GRADIENTS[idx % GRADIENTS.length];

  const openMore = async () => {
    setMoreOpen(true);
    if (summary) return;
    setSummaryLoading(true);
    const correct = q.options[q.correct_index];
    const res = await explainQuestion({ data: { question: q.question, correct_answer: correct } });
    setSummary(res.summary || res.error || "Couldn't load summary.");
    setSummaryLoading(false);
  };

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Floating More button — sits directly under the profile avatar in the header */}
      <button
        onClick={openMore}
        className="fixed top-[64px] right-5 z-30 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground hover:opacity-90 text-[11px] font-bold shadow-glow"
        aria-label="More info"
      >
        <Sparkles className="h-3.5 w-3.5" /> More
      </button>

      <div>
        <div className="flex items-center justify-between mb-2 text-sm gap-2">
          <span className="font-semibold text-primary truncate">{title}</span>
          <span className="text-muted-foreground flex-shrink-0">{idx + 1} / {questions.length}</span>
        </div>
        <Progress value={((idx + (answered ? 1 : 0)) / questions.length) * 100} className="h-2" />
      </div>

      <div className="rounded-3xl bg-card shadow-card border border-border overflow-hidden">
        {/* Visual header — emoji graphic or image */}
        <div className={cn("relative bg-gradient-to-br flex items-center justify-center p-8 min-h-[180px] overflow-hidden", grad)}>
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/30 blur-3xl animate-pulse" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/20 blur-3xl animate-pulse [animation-delay:600ms]" />
          {q.image_url ? (
            <img src={q.image_url} alt="" className="relative max-h-48 rounded-2xl object-contain animate-scale-in" />
          ) : (
            <div key={idx} className="relative text-7xl md:text-8xl select-none animate-scale-in drop-shadow-lg" aria-hidden>
              {q.emoji || "🧠"}
            </div>
          )}
        </div>

        <div className="p-6 md:p-8">
        {q.author && (
          <p className="text-xs text-muted-foreground mb-3">
            Created by <span className="font-semibold text-primary">{q.author}</span>
          </p>
        )}
        <h2 className="text-xl md:text-2xl font-bold mb-6 leading-snug animate-fade-in">{q.question}</h2>
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct_index;
            const isPicked = i === picked;
            return (
              <button
                key={i}
                disabled={answered}
                onClick={() => {
                  setPicked(i);
                  if (i === q.correct_index) setScore((s) => s + 1);
                }}
                style={{ animationDelay: `${i * 60}ms` }}
                className={cn(
                  "relative min-h-[64px] p-3 rounded-2xl border-2 font-semibold text-sm sm:text-base transition-all flex items-center justify-center text-center animate-scale-in",
                  !answered && "border-border hover:border-primary hover:bg-primary/5 hover:scale-[1.03] active:scale-95 cursor-pointer",
                  answered && isCorrect && "border-success bg-success/15 text-success-foreground scale-[1.02]",
                  answered && isPicked && !isCorrect && "border-destructive bg-destructive/15",
                  answered && !isPicked && !isCorrect && "border-border opacity-50",
                )}
              >
                <span className="line-clamp-2 leading-tight">{opt}</span>
                {answered && isCorrect && <Check className="absolute top-1.5 right-1.5 h-4 w-4 text-success" />}
                {answered && isPicked && !isCorrect && <X className="absolute top-1.5 right-1.5 h-4 w-4 text-destructive" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-5 p-4 rounded-2xl bg-muted text-sm animate-slide-in">
            <span className="font-semibold">💡 </span>{q.explanation}
          </div>
        )}

        {answered && (
          <Button
            onClick={() => {
              if (idx + 1 >= questions.length) setDone(true);
              else { setIdx(idx + 1); setPicked(null); setSummary(""); }
            }}
            className="w-full mt-5 h-12 rounded-2xl bg-gradient-hero font-semibold"
          >
            {idx + 1 >= questions.length ? "See results" : "Next question"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        </div>
      </div>

      {moreOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] bg-background/30 backdrop-blur-2xl overflow-y-auto animate-slide-in">
          <button
            onClick={() => setMoreOpen(false)}
            aria-label="Close"
            className="fixed top-4 right-4 z-[101] h-10 w-10 rounded-full bg-background/80 hover:bg-background border border-border flex items-center justify-center shadow-card"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-16 pb-12">
            <h3 className="flex items-center gap-2 text-3xl font-bold mb-6 pr-10 text-foreground">
              <BookOpen className="h-7 w-7 text-primary" /> Deep dive
            </h3>
            {summaryLoading ? (
              <div className="flex items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Crafting an interactive summary…
              </div>
            ) : (
              <div className="prose prose-lg max-w-none whitespace-pre-wrap text-foreground leading-relaxed text-base sm:text-lg">
                {summary}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
