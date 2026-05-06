import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles, Trash2, Heart, MessageCircle, Share2, Pencil, Send, X, Check, Repeat2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  reposted_from_user?: string | null;
  reposted_from_post?: string | null;
  reposted_author?: { display_name: string } | null;
  author?: { display_name: string; avatar_url: string | null };
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: { display_name: string; avatar_url: string | null };
};

function Posts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, number>>({});

  // Likes: postId -> { count, likedByMe }
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  // Comments per post
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, string>>({}); // commentId -> text
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [editForm, setEditForm] = useState<{ question: string; options: string[]; correct_index: number; explanation: string }>({
    question: "", options: ["", "", "", ""], correct_index: 0, explanation: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: quizzes } = await supabase
      .from("user_quizzes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!quizzes) { setLoading(false); return; }

    const ids = Array.from(new Set([
      ...quizzes.map((q) => q.author_id),
      ...quizzes.map((q) => (q as any).reposted_from_user).filter(Boolean) as string[],
    ]));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", ids);

    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const finalPosts = quizzes.map((q) => {
      const rfu = (q as any).reposted_from_user as string | null | undefined;
      return {
        ...q,
        options: q.options as string[],
        author: profMap.get(q.author_id)
          ? { display_name: profMap.get(q.author_id)!.display_name, avatar_url: profMap.get(q.author_id)!.avatar_url }
          : undefined,
        reposted_author: rfu && profMap.get(rfu)
          ? { display_name: profMap.get(rfu)!.display_name }
          : null,
      };
    }) as Post[];
    setPosts(finalPosts);

    // Load likes summary
    const postIds = finalPosts.map((p) => p.id);
    if (postIds.length > 0) {
      const { data: likeRows } = await supabase
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds);
      const summary: Record<string, { count: number; mine: boolean }> = {};
      for (const id of postIds) summary[id] = { count: 0, mine: false };
      for (const r of likeRows ?? []) {
        summary[r.post_id].count += 1;
        if (user && r.user_id === user.id) summary[r.post_id].mine = true;
      }
      setLikes(summary);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("user_quizzes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const startEdit = (p: Post) => {
    setEditPost(p);
    setEditForm({
      question: p.question,
      options: [...p.options],
      correct_index: p.correct_index,
      explanation: p.explanation ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editPost) return;
    if (!editForm.question.trim() || editForm.options.some((o) => !o.trim())) {
      toast.error("Fill in the question and all 4 options");
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase.from("user_quizzes").update({
      question: editForm.question.trim(),
      options: editForm.options.map((o) => o.trim()),
      correct_index: editForm.correct_index,
      explanation: editForm.explanation.trim() || null,
    }).eq("id", editPost.id);
    setSavingEdit(false);
    if (error) toast.error(error.message);
    else { toast.success("Post updated"); setEditPost(null); load(); }
  };

  const repost = async (p: Post) => {
    if (!user) return;
    if (p.author_id === user.id) { toast.error("You can't repost your own post"); return; }
    // Avoid duplicate reposts by the same user
    const { data: existing } = await supabase
      .from("user_quizzes")
      .select("id")
      .eq("author_id", user.id)
      .eq("reposted_from_post", p.id)
      .maybeSingle();
    if (existing) { toast.info("You've already reposted this"); return; }

    const originalSourceUser = p.reposted_from_user ?? p.author_id;
    const { error } = await supabase.from("user_quizzes").insert({
      author_id: user.id,
      topic: p.topic,
      difficulty: p.difficulty,
      question: p.question,
      options: p.options,
      correct_index: p.correct_index,
      explanation: p.explanation,
      image_url: p.image_url,
      reposted_from_user: originalSourceUser,
      reposted_from_post: p.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Reposted"); load(); }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const cur = likes[postId] ?? { count: 0, mine: false };
    // Optimistic
    setLikes((s) => ({ ...s, [postId]: { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine } }));
    if (cur.mine) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    }
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (!data) return;
    const ids = Array.from(new Set(data.map((c) => c.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", ids);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    setComments((s) => ({
      ...s,
      [postId]: data.map((c) => ({
        ...c,
        author: profMap.get(c.user_id)
          ? { display_name: profMap.get(c.user_id)!.display_name, avatar_url: profMap.get(c.user_id)!.avatar_url }
          : undefined,
      })),
    }));
  };

  const toggleComments = async (postId: string) => {
    const next = !openComments[postId];
    setOpenComments((s) => ({ ...s, [postId]: next }));
    if (next && !comments[postId]) await loadComments(postId);
  };

  const submitComment = async (postId: string) => {
    if (!user) return;
    const text = (drafts[postId] ?? "").trim();
    if (!text) return;
    setDrafts((s) => ({ ...s, [postId]: "" }));
    const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content: text });
    if (error) toast.error(error.message);
    else loadComments(postId);
  };

  const saveCommentEdit = async (commentId: string, postId: string) => {
    const text = (editing[commentId] ?? "").trim();
    if (!text) return;
    const { error } = await supabase.from("post_comments")
      .update({ content: text, updated_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) toast.error(error.message);
    else {
      setEditing((s) => { const n = { ...s }; delete n[commentId]; return n; });
      loadComments(postId);
    }
  };

  const deleteComment = async (commentId: string, postId: string) => {
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
    if (error) toast.error(error.message);
    else loadComments(postId);
  };

  const sharePost = async (p: Post) => {
    const url = typeof window !== "undefined" ? window.location.origin + "/posts" : "";
    const shareData = { title: "Quiz post", text: p.question, url };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
      } else {
        await navigator.clipboard.writeText(`${p.question}\n${url}`);
        toast.success("Link copied to clipboard");
      }
    } catch {
      /* user cancelled */
    }
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
        const lk = likes[p.id] ?? { count: 0, mine: false };
        const cms = comments[p.id] ?? [];
        return (
          <article key={p.id} className="rounded-3xl bg-card shadow-card border border-border overflow-hidden">
            {p.reposted_from_user && (
              <div className="px-4 pt-3 -mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Repeat2 className="h-3.5 w-3.5" />
                <span>{p.author?.display_name ?? "A user"} reposted{p.reposted_author ? ` from ${p.reposted_author.display_name}` : ""}</span>
              </div>
            )}
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
                <>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(p)} className="rounded-full" aria-label="Edit post">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)} className="rounded-full" aria-label="Delete post">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </header>

            {p.image_url && (
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-6">
                <img src={p.image_url} alt="" className="max-h-64 rounded-2xl object-contain" />
              </div>
            )}

            {p.question?.trim() && (
              <div className="p-5">
                <h2 className="text-lg font-bold mb-4 leading-snug">{p.question}</h2>
                <div className="space-y-2">
                  {p.options.map((opt, i) => {
                    if (!opt?.trim()) return null;
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
            )}

            {/* Instagram-style action bar */}
            <div className="px-5 pb-2 flex items-center gap-1 border-t border-border pt-2">
              <button
                onClick={() => toggleLike(p.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted transition-colors ${lk.mine ? "text-destructive" : ""}`}
                aria-label="Like"
              >
                <Heart className={`h-5 w-5 ${lk.mine ? "fill-current" : ""}`} />
                <span className="text-sm font-semibold">{lk.count}</span>
              </button>
              <button
                onClick={() => toggleComments(p.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Comments"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm font-semibold">{cms.length || ""}</span>
              </button>
              {user?.id !== p.author_id && (
                <button
                  onClick={() => repost(p)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted transition-colors text-success"
                  aria-label="Repost"
                  title="Repost"
                >
                  <Repeat2 className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => sharePost(p)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-muted transition-colors ml-auto"
                aria-label="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>

            {openComments[p.id] && (
              <div className="border-t border-border p-4 space-y-3 bg-muted/30">
                {cms.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">Be the first to comment.</p>
                )}
                {cms.map((c) => {
                  const mine = c.user_id === user?.id;
                  const isEditing = editing[c.id] !== undefined;
                  return (
                    <div key={c.id} className="flex gap-2">
                      <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-hero flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {c.author?.avatar_url ? (
                          <img src={c.author.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>{(c.author?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex gap-1.5 items-center">
                            <Input
                              value={editing[c.id]}
                              onChange={(e) => setEditing((s) => ({ ...s, [c.id]: e.target.value }))}
                              className="h-9 rounded-xl text-sm"
                              onKeyDown={(e) => e.key === "Enter" && saveCommentEdit(c.id, p.id)}
                            />
                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" onClick={() => saveCommentEdit(c.id, p.id)}>
                              <Check className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" onClick={() => setEditing((s) => { const n = { ...s }; delete n[c.id]; return n; })}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-2xl bg-card border border-border px-3 py-2">
                              <p className="text-xs font-bold">{c.author?.display_name ?? "User"}</p>
                              <p className="text-sm break-words">{c.content}</p>
                            </div>
                            <div className="flex gap-3 items-center mt-1 px-2 text-xs text-muted-foreground">
                              <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                              {c.updated_at !== c.created_at && <span className="italic">edited</span>}
                              {mine && (
                                <>
                                  <button
                                    onClick={() => setEditing((s) => ({ ...s, [c.id]: c.content }))}
                                    className="font-semibold hover:text-foreground inline-flex items-center gap-1"
                                  >
                                    <Pencil className="h-3 w-3" /> Edit
                                  </button>
                                  <button
                                    onClick={() => deleteComment(c.id, p.id)}
                                    className="font-semibold hover:text-destructive inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add comment */}
                <div className="flex gap-2 items-center pt-1">
                  <Input
                    placeholder="Add a comment…"
                    value={drafts[p.id] ?? ""}
                    onChange={(e) => setDrafts((s) => ({ ...s, [p.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && submitComment(p.id)}
                    className="h-10 rounded-full bg-card"
                    maxLength={500}
                  />
                  <Button
                    onClick={() => submitComment(p.id)}
                    size="icon"
                    className="h-10 w-10 rounded-full bg-gradient-hero flex-shrink-0"
                    disabled={!(drafts[p.id] ?? "").trim()}
                    aria-label="Post"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </article>
        );
      })}

      {/* Edit post dialog (own posts only) */}
      <Dialog open={!!editPost} onOpenChange={(o) => !o && setEditPost(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit your post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Textarea
                value={editForm.question}
                onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                maxLength={500}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Options (tap the dot to mark the correct one)</Label>
              {editForm.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, correct_index: i }))}
                    className={`h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      editForm.correct_index === i ? "border-success bg-success text-white" : "border-border"
                    }`}
                    aria-label={`Mark option ${i + 1} correct`}
                  >
                    {editForm.correct_index === i && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => setEditForm((f) => {
                      const o = [...f.options]; o[i] = e.target.value; return { ...f, options: o };
                    })}
                    maxLength={120}
                    className="h-10 rounded-xl"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Explanation (optional)</Label>
              <Textarea
                value={editForm.explanation}
                onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))}
                maxLength={400}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setEditPost(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="rounded-full bg-gradient-hero">
              <Check className="h-4 w-4 mr-1" /> Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
