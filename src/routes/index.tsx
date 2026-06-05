import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TrendingUp, Trophy, Play, CalendarDays, Pencil, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

type ChapterProgressRow = {
  subject: string;
  chapter: string;
  best_score: number;
  completed_at: string;
};

function Home() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<{ current_level: number; total_score: number } | null>(null);
  const [name, setName] = useState("");
  const [chapterProgress, setChapterProgress] = useState<ChapterProgressRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("level_progress").select("current_level,total_score").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProgress(data));
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));
    supabase.from("chapter_progress")
      .select("subject,chapter,best_score,completed_at")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { if (data) setChapterProgress(data as ChapterProgressRow[]); });
  }, [user]);

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="rounded-3xl bg-gradient-hero p-7 text-white shadow-glow relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <p className="text-white/80 text-sm font-medium">Welcome back{name ? `, ${name}` : ""}</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1">Ready to learn something new?</h1>
        <div className="mt-6 flex items-center gap-4 flex-wrap">
          {progress && (
            <>
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="Level" value={progress.current_level} />
              <Stat icon={<Trophy className="h-4 w-4" />} label="Score" value={progress.total_score} />
              <Stat icon={<BookOpen className="h-4 w-4" />} label="Chapters" value={chapterProgress.length} />
            </>
          )}
          <Link
            to="/play"
            className="ml-auto inline-flex items-center gap-1.5 bg-white text-foreground font-bold px-3 py-2 md:px-6 md:py-3 rounded-full shadow-soft hover:scale-105 transition-transform text-sm md:text-base"
          >
            <Play className="h-4 w-4 md:h-5 md:w-5 fill-current" /> Start
          </Link>
        </div>
      </div>

      <ProgressCarousel rows={chapterProgress} />
    </div>
  );
}

function ProgressCarousel({ rows }: { rows: ChapterProgressRow[] }) {
  const [slide, setSlide] = useState(0);
  const slides = ["progress", "calendar"] as const;

  // Aggregate per subject: count of chapters mastered + average best score.
  const subjectStats = useMemo(() => {
    const map = new Map<string, { subject: string; chapters: number; avgScore: number; sumScore: number }>();
    for (const r of rows) {
      const cur = map.get(r.subject) ?? { subject: r.subject, chapters: 0, avgScore: 0, sumScore: 0 };
      cur.chapters += 1;
      cur.sumScore += r.best_score;
      cur.avgScore = Math.round(cur.sumScore / cur.chapters);
      map.set(r.subject, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.chapters - a.chapters).slice(0, 8);
  }, [rows]);

  return (
    <div className="rounded-3xl bg-card p-6 shadow-card border border-border">
      <div className="flex justify-center gap-2 mb-4">
        {slides.map((s, i) => (
          <button
            key={s}
            onClick={() => setSlide(i)}
            aria-label={`Go to ${s}`}
            className={`h-2 rounded-full transition-all ${
              i === slide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>

      {slide === 0 ? (
        <>
          <h2 className="font-bold text-lg flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4" /> Chapter mastery
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Bars show chapters completed per subject — taller means more chapters mastered.
          </p>
          {subjectStats.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Finish a chapter in <Link to="/chapters" className="text-primary font-semibold">Chapters mode</Link> to see your progress here.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectStats} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 280)" />
                  <XAxis dataKey="subject" stroke="oklch(0.5 0.02 280)" fontSize={11} interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} stroke="oklch(0.5 0.02 280)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-card)" }}
                    formatter={(v: number, n: string) => [v, n === "chapters" ? "Chapters done" : "Avg score"]}
                  />
                  <Bar dataKey="chapters" radius={[8, 8, 0, 0]}>
                    {subjectStats.map((_, i) => (
                      <Cell key={i} fill={`oklch(0.62 0.22 ${(i * 47) % 360})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <CalendarPanel />
      )}
    </div>
  );
}

function CalendarPanel() {
  const { user } = useAuth();
  const [month, setMonth] = useState<Date>(new Date());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Date | undefined>();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Date key whose tooltip-bubble is currently shown. The bubble is rendered
  // as a positioned speech-bubble ABOVE the actual date cell (like the screenshot),
  // not as a separate dialog/below-the-calendar panel.
  const [bubbleKey, setBubbleKey] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    const f = new Date(month.getFullYear(), month.getMonth(), 1);
    const t = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) };
  }, [month]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("date_captions")
      .select("date,caption")
      .eq("user_id", user.id)
      .gte("date", from)
      .lte("date", to)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((r: any) => { map[r.date] = r.caption; });
        setCaptions(map);
      });
  }, [user, from, to]);

  // Close any open bubble when clicking anywhere outside a date cell.
  useEffect(() => {
    if (!bubbleKey) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-day-cell]")) setBubbleKey(null);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [bubbleKey]);

  const key = (d: Date) => format(d, "yyyy-MM-dd");

  const openEditor = (d: Date) => {
    setSelected(d);
    setDraft(captions[key(d)] ?? "");
    setBubbleKey(null);
    setOpen(true);
  };

  const handleDayClick = (d: Date) => {
    const k = key(d);
    setSelected(d);
    const existing = captions[k];
    if (existing) {
      setBubbleKey((cur) => (cur === k ? null : k));
    } else {
      openEditor(d);
    }
  };

  const removeCaption = async (d: Date) => {
    if (!user) return;
    const k = key(d);
    await supabase.from("date_captions").delete().eq("user_id", user.id).eq("date", k);
    const next = { ...captions };
    delete next[k];
    setCaptions(next);
    setBubbleKey(null);
    toast.success("Caption removed");
  };

  const save = async () => {
    if (!user || !selected) return;
    setSaving(true);
    const k = key(selected);
    if (draft.trim() === "") {
      await supabase.from("date_captions").delete().eq("user_id", user.id).eq("date", k);
      const next = { ...captions };
      delete next[k];
      setCaptions(next);
    } else {
      const { error } = await supabase
        .from("date_captions")
        .upsert({ user_id: user.id, date: k, caption: draft.trim() }, { onConflict: "user_id,date" });
      if (error) { toast.error("Could not save caption"); setSaving(false); return; }
      setCaptions({ ...captions, [k]: draft.trim() });
    }
    setSaving(false);
    setOpen(false);
    toast.success("Saved");
  };

  return (
    <>
      <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
        <CalendarDays className="h-4 w-4" /> Your calendar
      </h2>
      <div className="flex justify-center -mx-2 sm:mx-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && handleDayClick(d)}
          month={month}
          onMonthChange={setMonth}
          className="pointer-events-auto w-full max-w-[420px] [--cell-size:2.85rem] sm:[--cell-size:3.1rem] text-base"
          components={{
            DayButton: ({ day, modifiers, ...props }: any) => {
              const k = key(day.date);
              const cap = captions[k];
              const showBubble = bubbleKey === k && !!cap;
              return (
                <button
                  {...props}
                  data-day-cell
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDayClick(day.date);
                  }}
                  className={`relative aspect-square w-full rounded-xl text-base font-medium transition-all hover:bg-accent hover:scale-105 ${
                    modifiers?.today ? "ring-2 ring-primary/40 font-bold" : ""
                  } ${modifiers?.selected ? "bg-primary text-primary-foreground shadow-md scale-105" : ""}`}
                >
                  {day.date.getDate()}
                  {/* small dot to indicate a caption exists */}
                  {cap && !showBubble && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                  {/* Speech bubble — rectangular, rounded, with a downward pointer touching this date */}
                  {showBubble && (
                    <span
                      role="dialog"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-50 w-max max-w-[240px] px-3 py-2 rounded-2xl bg-white border-2 border-foreground text-foreground text-xs font-semibold shadow-glow whitespace-normal text-left animate-scale-in"
                    >
                      {cap}
                      {/* Pointer touching the date cell */}
                      <span
                        aria-hidden
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 bg-white border-b-2 border-r-2 border-foreground"
                      />
                    </span>
                  )}
                </button>
              );
            },
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center mt-3">
        Tap an empty date to add a caption. Tap a captioned date to see its bubble.
      </p>

      {bubbleKey && captions[bubbleKey] && (
        <div className="mt-3 flex items-center gap-2 justify-center flex-wrap">
          <Button size="sm" variant="outline" className="rounded-full"
            onClick={() => selected && openEditor(selected)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="outline"
            className="rounded-full text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => selected && removeCaption(selected)}>
            Remove
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              {selected ? format(selected, "PPP") : ""}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a caption (e.g. a person's name)…"
            rows={4}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-xs text-white/70">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}
