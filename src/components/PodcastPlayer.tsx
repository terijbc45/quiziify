import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrainLoader } from "@/components/BrainLoader";
import { Headphones, Pause, Play, RotateCcw, Square } from "lucide-react";
import type { PodcastLine } from "@/lib/study.functions";

export function PodcastPlayer({
  title,
  summary,
  lines,
  loading,
  error,
  language = "en",
  onRetry,
}: {
  title: string;
  summary?: string;
  lines: PodcastLine[];
  loading: boolean;
  error: string | null;
  language?: "en" | "ne";
  onRetry: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const stopRef = useRef(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const voices = useMemo(() => {
    if (!supported) return { host: undefined, guest: undefined } as Record<string, SpeechSynthesisVoice | undefined>;
    const all = window.speechSynthesis.getVoices();
    const pref = all.filter((v) => (language === "ne" ? /ne|hi/i.test(v.lang) : /^en/i.test(v.lang)));
    const pool = pref.length ? pref : all;
    return { host: pool[0], guest: pool[1] ?? pool[0] };
  }, [supported, language, lines.length]);

  useEffect(() => {
    return () => {
      stopRef.current = true;
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speakFrom = (start: number) => {
    if (!supported) return;
    stopRef.current = false;
    setPlaying(true);
    const run = (n: number) => {
      if (stopRef.current || n >= lines.length) {
        setPlaying(false);
        return;
      }
      idxRef.current = n;
      setIdx(n);
      const line = lines[n]!;
      const u = new SpeechSynthesisUtterance(line.text);
      const v = line.speaker === "Host" ? voices.host : voices.guest;
      if (v) u.voice = v;
      u.lang = language === "ne" ? "ne-NP" : "en-US";
      u.rate = line.speaker === "Host" ? 1.02 : 0.96;
      u.pitch = line.speaker === "Host" ? 1.12 : 0.95;
      u.onend = () => run(n + 1);
      u.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(u);
    };
    window.speechSynthesis.cancel();
    run(start);
  };

  const pause = () => {
    stopRef.current = true;
    if (supported) window.speechSynthesis.cancel();
    setPlaying(false);
  };

  if (loading) return <BrainLoader label="Recording your episode" />;
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
  if (!lines.length) return null;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="rounded-3xl bg-gradient-hero text-white p-6 shadow-glow relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-3 relative">
          <div className="h-12 w-12 rounded-2xl bg-white/15 grid place-items-center shrink-0">
            <Headphones className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-white/70">Study session</p>
            <h2 className="text-lg font-bold leading-tight truncate">{title}</h2>
          </div>
        </div>
        {summary && <p className="text-sm text-white/85 mt-3 relative">{summary}</p>}

        {/* Waveform */}
        <div className="flex items-end gap-1 h-10 mt-4 relative">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-full bg-white/70"
              style={{
                height: playing ? `${25 + Math.abs(Math.sin(i * 1.7)) * 70}%` : "18%",
                transition: "height 220ms ease",
                animation: playing ? `pulse 1.${(i % 7) + 1}s ease-in-out ${i * 40}ms infinite` : undefined,
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4 relative">
          {playing ? (
            <Button onClick={pause} variant="secondary" className="rounded-full font-bold">
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          ) : (
            <Button onClick={() => speakFrom(idxRef.current)} variant="secondary" className="rounded-full font-bold">
              <Play className="h-4 w-4 mr-1" /> {idxRef.current > 0 ? "Resume" : "Play"}
            </Button>
          )}
          <Button
            onClick={() => { pause(); idxRef.current = 0; setIdx(0); }}
            variant="ghost"
            className="rounded-full text-white hover:bg-white/15"
          >
            <Square className="h-4 w-4 mr-1" /> Restart
          </Button>
        </div>
        {!supported && (
          <p className="text-xs text-white/80 mt-3 relative">
            Audio playback isn't supported on this browser — read the transcript below.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <button
            key={i}
            onClick={() => speakFrom(i)}
            className={`w-full text-left rounded-2xl border p-3 transition-all ${
              i === idx
                ? "border-primary bg-primary/5 shadow-card"
                : "border-border bg-white hover:border-primary/50"
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
              {l.speaker === "Host" ? "🎙️ Host" : "👩‍🏫 Teacher"}
            </p>
            <p className="text-sm text-foreground leading-relaxed">{l.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
