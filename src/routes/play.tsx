import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Shuffle, BookOpen, ArrowLeft, Newspaper, Smile } from "lucide-react";

export const Route = createFileRoute("/play")({
  component: () => (
    <AppShell>
      <Play />
    </AppShell>
  ),
});

function Play() {
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
          to="/chapters"
          title="Chapters"
          desc="Learn your syllabus, chapter by chapter."
          icon={<BookOpen className="h-7 w-7" />}
          gradient="from-violet-500 to-blue-500"
        />
        <ModeCard
          to="/random"
          title="Random"
          desc="Curriculum subjects, mixed questions. Tap and play."
          icon={<Shuffle className="h-7 w-7" />}
          gradient="from-pink-500 to-orange-400"
        />
        <ModeCard
          to="/ramailo"
          title="Ramailo"
          desc="Quick, fun general-knowledge questions. No setup."
          icon={<Smile className="h-7 w-7" />}
          gradient="from-orange-400 to-pink-500"
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
