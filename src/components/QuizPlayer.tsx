import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, X, Loader2, ArrowRight, Trophy, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const GRADIENTS = [
  "from-pink-400/30 via-rose-300/20 to-orange-300/30",
  "from-violet-400/30 via-purple-300/20 to-fuchsia-300/30",
  "from-sky-400/30 via-cyan-300/20 to-blue-300/30",
  "from-emerald-400/30 via-teal-300/20 to-green-300/30",
  "from-amber-400/30 via-yellow-300/20 to-lime-300/30",
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-medium">Preparing your quiz…</p>
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
      <div>
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-semibold text-primary">{title}</span>
          <span className="text-muted-foreground">{idx + 1} / {questions.length}</span>
        </div>
        <Progress value={((idx + (answered ? 1 : 0)) / questions.length) * 100} className="h-2" />
      </div>

      <div className="rounded-3xl bg-card shadow-card border border-border overflow-hidden">
        {/* Visual header — emoji graphic or image */}
        <div className={cn("relative bg-gradient-to-br flex items-center justify-center p-8 min-h-[180px]", grad)}>
          {/* More button top-right */}
          <button
            onClick={openMore}
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur text-xs font-bold text-foreground hover:bg-white shadow-soft transition-all"
            aria-label="More info"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" /> More
          </button>

          {q.image_url ? (
            <img src={q.image_url} alt="" className="max-h-48 rounded-2xl object-contain" />
          ) : (
            <div className="text-7xl md:text-8xl select-none animate-slide-in" aria-hidden>
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
        <h2 className="text-xl md:text-2xl font-bold mb-6 leading-snug">{q.question}</h2>
        <div className="space-y-3">
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
                className={cn(
                  "w-full text-left p-4 rounded-2xl border-2 font-medium transition-all flex items-center justify-between",
                  !answered && "border-border hover:border-primary hover:bg-primary/5 cursor-pointer",
                  answered && isCorrect && "border-success bg-success/10 text-success-foreground",
                  answered && isPicked && !isCorrect && "border-destructive bg-destructive/10",
                  answered && !isPicked && !isCorrect && "border-border opacity-50",
                )}
              >
                <span>{opt}</span>
                {answered && isCorrect && <Check className="h-5 w-5 text-success" />}
                {answered && isPicked && !isCorrect && <X className="h-5 w-5 text-destructive" />}
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

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <BookOpen className="h-6 w-6 text-primary" /> Deep dive
            </DialogTitle>
          </DialogHeader>
          {summaryLoading ? (
            <div className="flex items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Crafting an interactive summary…
            </div>
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
              {summary}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
