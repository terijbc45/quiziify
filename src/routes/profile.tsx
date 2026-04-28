import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Save, Lock, User as UserIcon, Camera, LogOut, Trophy, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: () => (
    <AppShell>
      <Profile />
    </AppShell>
  ),
});

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(280),
});

function Profile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current_level: 1, total_score: 0 });
  const [attempts, setAttempts] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name);
          setBio(data.bio ?? "");
          setAvatar(data.avatar_url ?? null);
        }
      });
    supabase.from("level_progress").select("current_level,total_score").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setProgress(data); });
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setAttempts(count ?? 0));
    supabase.from("user_quizzes").select("id", { count: "exact", head: true }).eq("author_id", user.id)
      .then(({ count }) => setCreatedCount(count ?? 0));
  }, [user]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Max 4MB"); return; }
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); setBusy(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { setAvatar(publicUrl); toast.success("Profile photo updated"); }
  };

  const save = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({ display_name: displayName, bio });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: parsed.data.display_name,
      bio: parsed.data.bio,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); setEditing(false); }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) { toast.error("Min 8 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setNewPassword(""); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-in">
      {/* Cover + avatar — social media style */}
      <div className="rounded-3xl overflow-hidden shadow-card border border-border bg-card">
        <div className="h-32 md:h-40 bg-gradient-hero relative" />
        <div className="px-6 pb-6 -mt-12 md:-mt-14">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="relative">
              <div className="h-24 w-24 md:h-28 md:w-28 rounded-3xl overflow-hidden ring-4 ring-card bg-gradient-hero flex items-center justify-center text-white text-4xl font-bold shadow-glow">
                {avatar ? (
                  <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span>{(displayName || "?").slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft hover:scale-110 transition-transform disabled:opacity-50"
                aria-label="Change photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
              />
            </div>
            <div className="flex gap-2 mt-12 md:mt-14">
              <Button variant="outline" className="rounded-full" onClick={() => setEditing((v) => !v)}>
                {editing ? "Cancel" : "Edit profile"}
              </Button>
              <Button variant="ghost" className="rounded-full text-destructive" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign out
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-bold">{displayName || "Quizzer"}</h1>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
            {bio && <p className="mt-3 text-foreground/90 whitespace-pre-wrap">{bio}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
            <StatCell icon={<TrendingUp className="h-4 w-4" />} label="Level" value={progress.current_level} />
            <StatCell icon={<Trophy className="h-4 w-4" />} label="Score" value={progress.total_score} />
            <StatCell icon={<Sparkles className="h-4 w-4" />} label="Quizzes" value={attempts} />
          </div>
          {createdCount > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              You've contributed <span className="font-bold text-foreground">{createdCount}</span> question{createdCount === 1 ? "" : "s"} to the community.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <Section title="Edit profile" icon={<UserIcon className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} className="rounded-xl" placeholder="Tell people about yourself…" />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/280</p>
            </div>
            <Button onClick={save} disabled={busy} className="rounded-full bg-gradient-hero">
              <Save className="h-4 w-4 mr-1" /> Save changes
            </Button>
          </div>
        </Section>
      )}

      <Section title="Change password" icon={<Lock className="h-4 w-4" />}>
        <div className="flex gap-2">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8)"
            minLength={8}
            className="h-11 rounded-xl"
          />
          <Button onClick={changePassword} disabled={busy} variant="outline" className="rounded-full whitespace-nowrap">
            Update
          </Button>
        </div>
      </Section>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-card border border-border">
      <h2 className="font-bold text-lg flex items-center gap-2 mb-4">{icon} {title}</h2>
      {children}
    </div>
  );
}
