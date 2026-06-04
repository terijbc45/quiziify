import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TrendingUp, Trophy, Play, CalendarDays, Pencil, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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

function Home() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<{ current_level: number; total_score: number } | null>(null);
  const [name, setName] = useState("");
  const [chart, setChart] = useState<{ level: number; score: number; date: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("level_progress").select("current_level,total_score").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProgress(data));
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));
    supabase.from("quiz_attempts").select("level,score,created_at").eq("user_id", user.id).eq("mode", "level").order("created_at").limit(50)
      .then(({ data }) => {
        if (data) setChart(data.map((a) => ({ level: a.level ?? 0, score: a.score, date: format(new Date(a.created_at), "MMM d") })));
      });
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

      <ProgressCarousel chart={chart} />
    </div>
  );
}

function ProgressCarousel({ chart }: { chart: { level: number; score: number; date: string }[] }) {
  const [slide, setSlide] = useState(0);
  const slides = ["progress", "calendar"] as const;

  return (
    <div className="rounded-3xl bg-card p-6 shadow-card border border-border">
      {/* Carousel dots ABOVE the title */}
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
          <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4" /> Your progress
          </h2>
          {chart.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Play Level mode to see your progress here.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 280)" />
                  <XAxis dataKey="date" stroke="oklch(0.5 0.02 280)" fontSize={12} />
                  <YAxis stroke="oklch(0.5 0.02 280)" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-card)" }} />
                  <Line type="monotone" dataKey="level" stroke="oklch(0.62 0.22 295)" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="score" stroke="oklch(0.7 0.18 150)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
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
  // Speech-bubble popup state — shown when tapping a date that already has a caption.
  const [bubble, setBubble] = useState<{ date: Date; caption: string } | null>(null);

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

  const key = (d: Date) => format(d, "yyyy-MM-dd");

  const openEditor = (d: Date) => {
    setSelected(d);
    setDraft(captions[key(d)] ?? "");
    setBubble(null);
    setOpen(true);
  };

  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    setSelected(d);
    const existing = captions[key(d)];
    if (existing) {
      // Show the caption as a speech-bubble popup (like the reference image).
      setBubble({ date: d, caption: existing });
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
    setBubble(null);
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
          onSelect={handleSelect}
          month={month}
          onMonthChange={setMonth}
          className="pointer-events-auto w-full max-w-[420px] [--cell-size:2.85rem] sm:[--cell-size:3.1rem] text-base"
          components={{
            DayButton: ({ day, modifiers, ...props }: any) => {
              const k = key(day.date);
              const cap = captions[k];
              return (
                <button
                  {...props}
                  className={`relative aspect-square w-full rounded-xl text-base font-medium transition-all hover:bg-accent hover:scale-105 ${
                    modifiers?.today ? "ring-2 ring-primary/40 font-bold" : ""
                  } ${modifiers?.selected ? "bg-primary text-primary-foreground shadow-md scale-105" : ""}`}
                >
                  {day.date.getDate()}
                  {cap && (
                    <span
                      aria-label={`Caption: ${cap}`}
                      className="absolute -top-2 left-full -translate-x-1 z-10 max-w-[88px] px-1.5 py-0.5 rounded-lg rounded-bl-sm border border-foreground/70 bg-background text-foreground text-[9px] font-semibold leading-tight shadow-sm truncate pointer-events-none"
                    >
                      {cap}
                    </span>
                  )}
                </button>
              );
            },
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center mt-3">
        Tap a date with a caption to see its popup, or tap an empty date to add one.
      </p>

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
            placeholder="Add a caption (optional)…"
            rows={4}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Speech-bubble caption popup — shown when tapping a date that has a caption */}
      {bubble && (
        <div
          className="fixed inset-0 z-[80] bg-background/60 backdrop-blur-md flex items-center justify-center p-6 animate-slide-in"
          onClick={() => setBubble(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-sm w-full flex flex-col items-center"
          >
            <p className="text-white text-xs font-semibold mb-3 px-3 py-1 rounded-full bg-foreground/80 shadow-soft">
              {format(bubble.date, "PPP")}
            </p>
            <div className="relative inline-block w-full">
              <div className="relative px-5 py-4 rounded-3xl rounded-bl-md border-2 border-foreground bg-background text-foreground text-lg font-semibold shadow-glow break-words text-center animate-scale-in">
                {bubble.caption}
                <span
                  aria-hidden
                  className="absolute -bottom-2.5 left-6 h-5 w-5 rotate-45 border-b-2 border-r-2 border-foreground bg-background"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 flex-wrap justify-center">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEditor(bubble.date)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => removeCaption(bubble.date)}
              >
                Remove
              </Button>
              <Button size="sm" className="rounded-full bg-gradient-hero" onClick={() => setBubble(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
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
