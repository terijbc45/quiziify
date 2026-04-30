import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Shuffle, Sparkles, ArrowLeft, Newspaper } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/play")({
  component: () => (
    <AppShell>
      <Play />
    </AppShell>
  ),
});

function Play() {
  const { user } = useAuth();
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("level_progress")
      .select("current_level")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setLevel(data?.current_level ?? 1));
  }, [user]);

  return (
    <div className="space-y-6 animate-slide-in max-w-3xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Choose a mode</h1>
        <p className="text-muted-foreground mt-1">Pick how you want to play today.</p>
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
          desc={`Climb endless levels.${level ? ` Currently L${level}.` : ""}`}
          icon={<Sparkles className="h-7 w-7" />}
          gradient="from-violet-500 to-blue-500"
        />
        <ModeCard
          to="/posts"
          title="Posts"
          desc="See quizzes posted by the community, with author info."
          icon={<Newspaper className="h-7 w-7" />}
          gradient="from-emerald-500 to-teal-400"
        />
      </div>
    </div>
  );
}

function ModeCard({
  to,
  title,
  desc,
  icon,
  gradient,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-3xl bg-card p-6 shadow-card hover:shadow-glow transition-all hover:-translate-y-1 border border-border"
    >
      <div
        className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-soft mb-4 group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm">{desc}</p>
    </Link>
  );
}
