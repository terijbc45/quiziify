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
import { Save, Lock, User as UserIcon, Camera, LogOut, Trophy, TrendingUp, Sparkles, Image as ImageIcon, Pencil } from "lucide-react";
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
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
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
          setCover((data as any).cover_photo_url ?? null);
        }
      });
    supabase.from("level_progress").select("current_level,total_score").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setProgress(data); });
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setAttempts(count ?? 0));
    supabase.from("user_quizzes").select("id", { count: "exact", head: true }).eq("author_id", user.id)
      .then(({ count }) => setCreatedCount(count ?? 0));
  }, [user]);

  const uploadImage = async (file: File, kind: "avatar" | "cover") => {
    if (!user) return;
    if (file.size > 6 * 1024 * 1024) { toast.error("Max 6MB"); return; }
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); setBusy(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const update = kind === "avatar" ? { avatar_url: publicUrl } : { cover_photo_url: publicUrl };
    const { error } = await supabase.from("profiles").update({ ...update, updated_at: new Date().toISOString() }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      if (kind === "avatar") setAvatar(publicUrl); else setCover(publicUrl);
      toast.success(kind === "avatar" ? "Profile photo updated" : "Cover photo updated");
    }
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
    if (!user?.email) { toast.error("No email on account"); return; }
    if (!oldPassword) { toast.error("Enter your current password"); return; }
    if (newPassword.length < 8) { toast.error("New password: min 8 characters"); return; }
    if (oldPassword === newPassword) { toast.error("New password must differ from the old one"); return; }
    setBusy(true);
    // Verify old password by re-authenticating
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });
    if (authErr) { setBusy(false); toast.error("Current password is incorrect"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setOldPassword(""); setNewPassword(""); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-in">
      {/* Cover + centered avatar — Facebook-style */}
      <div className="rounded-3xl overflow-hidden shadow-card border border-border bg-card">
        <div className="relative h-44 sm:h-56 md:h-64">
          {cover ? (
            <img src={cover} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-hero" />
          )}
          <button
            onClick={() => coverRef.current?.click()}
            disabled={busy}
            className="absolute top-3 right-3 h-9 px-3 rounded-full bg-background/90 hover:bg-background flex items-center gap-1.5 text-sm font-semibold shadow-soft disabled:opacity-50"
            aria-label="Change cover photo"
          >
            <ImageIcon className="h-4 w-4" /> <span className="hidden sm:inline">Change cover</span>
          </button>
          <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "cover"); }} />

          {/* Centered circular avatar */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-16 sm:-bottom-20">
            <div className="relative">
              <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-full overflow-hidden ring-4 ring-card bg-gradient-hero flex items-center justify-center text-white text-5xl font-bold shadow-glow">
                {avatar ? (
                  <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span>{(displayName || "?").slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={busy}
                className="absolute bottom-1 right-1 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft hover:scale-110 transition-transform disabled:opacity-50 ring-2 ring-card"
                aria-label="Change photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "avatar"); }} />
            </div>
          </div>
        </div>

        {/* Spacer for the overflowing avatar */}
        <div className="pt-20 sm:pt-24 px-6 pb-6">
          {/* Name & email — centered (also on mobile, immediately under avatar) */}
          <div className="text-center">
            <h1 className="text-2xl font-bold">{displayName || "Quizzer"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{user?.email}</p>
            {bio && <p className="mt-3 text-foreground/90 whitespace-pre-wrap">{bio}</p>}
          </div>

          {/* Actions row: Sign out (left) and Edit profile (right) */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button variant="outline" className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
            <Button className="rounded-full bg-gradient-hero" onClick={() => setEditing((v) => !v)}>
              <Pencil className="h-4 w-4 mr-1" /> {editing ? "Cancel" : "Edit profile"}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-border">
            <StatCell icon={<TrendingUp className="h-4 w-4" />} label="Level" value={progress.current_level} />
            <StatCell icon={<Trophy className="h-4 w-4" />} label="Score" value={progress.total_score} />
            <StatCell icon={<Sparkles className="h-4 w-4" />} label="Quizzes" value={attempts} />
          </div>
          {createdCount > 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              You've contributed <span className="font-bold text-foreground">{createdCount}</span> question{createdCount === 1 ? "" : "s"} to the community.
            </p>
          )}
        </div>
      </div>

      <Section title="Change password" icon={<Lock className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter your current password"
              className="h-11 rounded-xl"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              minLength={8}
              className="h-11 rounded-xl"
              autoComplete="new-password"
            />
          </div>
          <Button onClick={changePassword} disabled={busy} className="rounded-full bg-gradient-hero">
            Update password
          </Button>
        </div>
      </Section>

      {/* Fullscreen edit overlay — covers the entire device screen */}
      {editing && (
        <div className="fixed inset-0 z-[60] bg-background overflow-y-auto animate-slide-in">
          <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/90 border-b border-border">
            <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
              <button
                onClick={() => setEditing(false)}
                className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <h2 className="font-bold text-lg">Edit profile</h2>
              <Button onClick={save} disabled={busy} size="sm" className="rounded-full bg-gradient-hero">
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
          <div className="max-w-2xl mx-auto p-5 space-y-6">
            {/* Cover preview + change */}
            <div>
              <Label className="mb-2 block">Cover photo</Label>
              <div className="relative h-40 sm:h-52 rounded-2xl overflow-hidden border border-border">
                {cover ? (
                  <img src={cover} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-hero" />
                )}
                <button
                  onClick={() => coverRef.current?.click()}
                  disabled={busy}
                  className="absolute bottom-3 right-3 h-9 px-3 rounded-full bg-background/90 hover:bg-background flex items-center gap-1.5 text-sm font-semibold shadow-soft disabled:opacity-50"
                >
                  <ImageIcon className="h-4 w-4" /> Change cover
                </button>
              </div>
            </div>

            {/* Avatar change */}
            <div>
              <Label className="mb-2 block">Profile picture</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden ring-2 ring-border bg-gradient-hero flex items-center justify-center text-white text-2xl font-bold">
                  {avatar ? (
                    <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span>{(displayName || "?").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <Button variant="outline" className="rounded-full" onClick={() => avatarRef.current?.click()} disabled={busy}>
                  <Camera className="h-4 w-4 mr-1" /> Change photo
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} className="rounded-xl min-h-[120px]" placeholder="Tell people about yourself…" />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/280</p>
            </div>

            <Button onClick={save} disabled={busy} className="w-full h-12 rounded-2xl bg-gradient-hero font-semibold">
              <Save className="h-4 w-4 mr-1" /> Save changes
            </Button>
          </div>
        </div>
      )}
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
