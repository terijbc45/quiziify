import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TrendingUp, Trophy, Play } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

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

      <div className="rounded-3xl bg-card p-6 shadow-card border border-border">
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
      </div>
    </div>
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
