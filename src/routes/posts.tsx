import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/posts")({
  component: () => (
    <AppShell>
      <Posts />
    </AppShell>
  ),
});

type Post = {
  id: string;
  author_id: string;
  topic: string;
  difficulty: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  image_url: string | null;
  created_at: string;
  author?: { display_name: string; avatar_url: string | null };
};

function Posts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const { data: quizzes } = await supabase
      .from("user_quizzes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!quizzes) { setLoading(false); return; }

    const ids = Array.from(new Set(quizzes.map((q) => q.author_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", ids);

    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    setPosts(
      quizzes.map((q) => ({
        ...q,
        options: q.options as string[],
        author: profMap.get(q.author_id)
          ? { display_name: profMap.get(q.author_id)!.display_name, avatar_url: profMap.get(q.author_id)!.avatar_url }
          : undefined,
      })) as Post[],
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("user_quizzes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-slide-in">
      <Link to="/play" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> Posts
        </h1>
        <p className="text-muted-foreground mt-1">Quizzes shared by the community.</p>
      </div>

      {loading && <p className="text-muted-foreground text-center py-8">Loading…</p>}
      {!loading && posts.length === 0 && (
        <div className="rounded-3xl bg-card p-8 text-center shadow-card border border-border">
          <p className="text-muted-foreground mb-4">No posts yet. Be the first!</p>
          <Link to="/create" className="text-primary font-semibold underline">Create a question</Link>
        </div>
      )}

      {posts.map((p) => {
        const picked = revealed[p.id];
        const answered = picked !== undefined;
        return (
          <article key={p.id} className="rounded-3xl bg-card shadow-card border border-border overflow-hidden">
            {/* Author row */}
            <header className="p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-full overflow-hidden bg-gradient-hero flex items-center justify-center text-white font-bold ring-2 ring-border">
                {p.author?.avatar_url ? (
                  <img src={p.author.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{(p.author?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{p.author?.display_name ?? "A user"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })} · {p.topic} · {p.difficulty}
                </p>
              </div>
              {user?.id === p.author_id && (
                <Button variant="ghost" size="icon" onClick={() => remove(p.id)} className="rounded-full">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </header>

            {/* Image (above question, like Duolingo style) */}
            {p.image_url && (
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-6">
                <img src={p.image_url} alt="" className="max-h-64 rounded-2xl object-contain" />
              </div>
            )}

            {/* Question */}
            <div className="p-5">
              <h2 className="text-lg font-bold mb-4 leading-snug">{p.question}</h2>
              <div className="space-y-2">
                {p.options.map((opt, i) => {
                  const isCorrect = i === p.correct_index;
                  const isPicked = i === picked;
                  return (
                    <button
                      key={i}
                      disabled={answered}
                      onClick={() => setRevealed((r) => ({ ...r, [p.id]: i }))}
                      className={`w-full text-left p-3 rounded-2xl border-2 font-medium transition-all text-sm ${
                        !answered ? "border-border hover:border-primary hover:bg-primary/5" :
                        isCorrect ? "border-success bg-success/10" :
                        isPicked ? "border-destructive bg-destructive/10" :
                        "border-border opacity-60"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {answered && p.explanation && (
                <div className="mt-3 p-3 rounded-2xl bg-muted text-sm">
                  💡 {p.explanation}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
