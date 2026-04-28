import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Save, Lock, User as UserIcon, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

export const Route = createFileRoute("/profile")({ component: () => <AppShell><Profile /></AppShell> });

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(280),
  avatar_url: z.string().trim().url().max(500).optional().or(z.literal("")),
});

function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [chart, setChart] = useState<{ level: number; score: number; date: string }[]>([]);
  const [progress, setProgress] = useState({ current_level: 1, total_score: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data) { setDisplayName(data.display_name); setBio(data.bio ?? ""); setAvatar(data.avatar_url ?? ""); } });
    supabase.from("level_progress").select("current_level,total_score").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setProgress(data); });
    supabase.from("quiz_attempts").select("level,score,created_at").eq("user_id", user.id).eq("mode", "level").order("created_at").limit(50)
      .then(({ data }) => {
        if (data) setChart(data.map((a) => ({ level: a.level ?? 0, score: a.score, date: format(new Date(a.created_at), "MMM d") })));
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({ display_name: displayName, bio, avatar_url: avatar });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: parsed.data.display_name,
      bio: parsed.data.bio,
      avatar_url: parsed.data.avatar_url || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  const changePassword = async () => {
    if (newPassword.length < 8) { toast.error("Min 8 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setNewPassword(""); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-3xl bg-gradient-hero p-7 text-white shadow-glow flex items-center gap-5 animate-slide-in">
        {avatar ? (
          <img src={avatar} alt="" className="h-20 w-20 rounded-3xl object-cover ring-4 ring-white/30" />
        ) : (
          <div className="h-20 w-20 rounded-3xl bg-white/20 flex items-center justify-center text-3xl font-bold">
            {displayName.slice(0, 1).toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{displayName || "Quizzer"}</h1>
          <p className="text-white/80 text-sm">Level {progress.current_level} · {progress.total_score} pts</p>
          {bio && <p className="text-white/90 text-sm mt-1 line-clamp-2">{bio}</p>}
        </div>
      </div>

      <Section title="Level progress" icon={<TrendingUp className="h-4 w-4" />}>
        {chart.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Play Level mode to see your progress here.</p>
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
      </Section>

      <Section title="Edit profile" icon={<UserIcon className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5"><Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} className="rounded-xl" />
          </div>
          <div className="space-y-1.5"><Label>Avatar URL</Label>
            <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." className="h-11 rounded-xl" />
          </div>
          <Button onClick={save} disabled={busy} className="rounded-full bg-gradient-hero">
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </div>
      </Section>

      <Section title="Change password" icon={<Lock className="h-4 w-4" />}>
        <div className="flex gap-2">
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 8)" minLength={8} className="h-11 rounded-xl" />
          <Button onClick={changePassword} disabled={busy} variant="outline" className="rounded-full whitespace-nowrap">Update</Button>
        </div>
      </Section>
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
