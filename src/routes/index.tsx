import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Shuffle, TrendingUp, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    if (!user) return;
    supabase.from("level_progress").select("current_level,total_score").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProgress(data));
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));
  }, [user]);

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="rounded-3xl bg-gradient-hero p-7 text-white shadow-glow relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <p className="text-white/80 text-sm font-medium">Welcome back{name ? `, ${name}` : ""}</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1">Ready to learn something new?</h1>
        {progress && (
          <div className="mt-6 flex gap-6">
            <Stat icon={<TrendingUp className="h-4 w-4" />} label="Level" value={progress.current_level} />
            <Stat icon={<Trophy className="h-4 w-4" />} label="Score" value={progress.total_score} />
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <ModeCard
          to="/random"
          title="Random"
          desc="Mixed questions. Pick your difficulty and dive in."
          icon={<Shuffle className="h-7 w-7" />}
          gradient="from-pink-500 to-orange-400"
        />
        <ModeCard
          to="/level"
          title="Level"
          desc={`Climb endless levels. ${progress ? `Currently L${progress.current_level}.` : ""}`}
          icon={<Sparkles className="h-7 w-7" />}
          gradient="from-violet-500 to-blue-500"
        />
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

function ModeCard({ to, title, desc, icon, gradient }: { to: string; title: string; desc: string; icon: React.ReactNode; gradient: string }) {
  return (
    <Link
      to={to}
      className="group rounded-3xl bg-card p-6 shadow-card hover:shadow-glow transition-all hover:-translate-y-1 border border-border"
    >
      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-soft mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm">{desc}</p>
    </Link>
  );
}
