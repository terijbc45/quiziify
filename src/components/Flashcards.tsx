import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrainLoader } from "@/components/BrainLoader";
import { ArrowLeft, ArrowRight, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import type { Flashcard } from "@/lib/study.functions";

export function Flashcards({
  cards,
  loading,
  error,
  title,
  onRetry,
}: {
  cards: Flashcard[];
  loading: boolean;
  error: string | null;
  title: string;
  onRetry: () => void;
}) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  if (loading) return <BrainLoader label="Writing your flashcards" />;
  if (error) {
    return (
      <div className="rounded-3xl bg-card border border-border p-8 text-center space-y-4">
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button onClick={onRetry} className="rounded-full bg-gradient-hero">
          <RotateCcw className="h-4 w-4 mr-1" /> Try again
        </Button>
      </div>
    );
  }
  if (!cards.length) return null;

  const card = cards[Math.min(i, cards.length - 1)]!;
  const go = (d: number) => {
    setFlipped(false);
    setShowHint(false);
    setI((v) => Math.min(cards.length - 1, Math.max(0, v + d)));
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground truncate">{title}</p>
        <span className="text-xs font-bold rounded-full bg-primary/10 text-primary px-3 py-1">
          {Math.min(i + 1, cards.length)} / {cards.length}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-hero transition-all duration-500"
          style={{ width: `${((i + 1) / cards.length) * 100}%` }}
        />
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="w-full text-left"
        style={{ perspective: "1400px" }}
        aria-label="Flip card"
      >
        <div
          className="relative w-full min-h-[15rem] transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-3xl bg-white border-2 border-border shadow-card p-7 flex flex-col items-center justify-center gap-3 text-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="text-xl font-bold text-foreground leading-snug">{card.front}</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Tap to reveal</p>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-3xl bg-gradient-hero text-white shadow-glow p-7 flex flex-col items-center justify-center gap-2 text-center overflow-hidden"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <p className="text-base font-medium leading-relaxed relative">{card.back}</p>
          </div>
        </div>
      </button>

      {card.hint && (
        <div className="text-center">
          {showHint ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" /> {card.hint}
            </p>
          ) : (
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setShowHint(true)}>
              <Lightbulb className="h-4 w-4 mr-1" /> Hint
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" className="rounded-full" onClick={() => go(-1)} disabled={i === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Prev
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => { setI(0); setFlipped(false); }}>
          <RotateCcw className="h-4 w-4 mr-1" /> Restart
        </Button>
        <Button
          className="rounded-full bg-gradient-hero font-bold"
          onClick={() => go(1)}
          disabled={i >= cards.length - 1}
        >
          Next <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
