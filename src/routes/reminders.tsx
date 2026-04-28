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
import { Bell, Trash2, Image as ImageIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/reminders")({ component: () => <AppShell><Reminders /></AppShell> });

type Reminder = {
  id: string; title: string; body: string | null; thumbnail_url: string | null;
  fire_at: string; fired: boolean;
};

const schema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().max(500).optional(),
  thumbnail_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  fire_at: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
});

function Reminders() {
  const { user } = useAuth();
  const [list, setList] = useState<Reminder[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [thumb, setThumb] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60_000);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("reminders").select("*").eq("user_id", user.id).order("fire_at", { ascending: true });
    if (data) setList(data as Reminder[]);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const add = async () => {
    if (!user) return;
    const parsed = schema.safeParse({ title, body, thumbnail_url: thumb, fire_at: new Date(when).toISOString() });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.from("reminders").insert({
      user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body || null,
      thumbnail_url: parsed.data.thumbnail_url || null,
      fire_at: parsed.data.fire_at,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reminder set");
    setTitle(""); setBody(""); setThumb("");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("reminders").delete().eq("id", id);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-3xl bg-card p-7 shadow-card border border-border animate-slide-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-hero flex items-center justify-center text-white shadow-soft">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reminders</h1>
            <p className="text-sm text-muted-foreground">Full-screen alarms with slide-to-stop.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Study session" maxLength={100} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5"><Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Time for your daily quiz!" maxLength={500} className="rounded-xl" />
          </div>
          <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Thumbnail URL (optional)</Label>
            <Input value={thumb} onChange={(e) => setThumb(e.target.value)} placeholder="https://..." className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5"><Label>When</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <Button onClick={add} disabled={busy} className="w-full h-12 rounded-2xl bg-gradient-hero font-semibold">
            <Plus className="h-4 w-4 mr-1" /> Set reminder
          </Button>
          <p className="text-xs text-muted-foreground text-center">Tip: Install this as an app for background notifications.</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold px-1">Your reminders ({list.length})</h2>
        {list.length === 0 && <p className="text-muted-foreground text-sm px-1">No reminders yet.</p>}
        {list.map((r) => (
          <div key={r.id} className="rounded-2xl bg-card p-4 shadow-card border border-border flex items-center gap-3">
            {r.thumbnail_url ? (
              <img src={r.thumbnail_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-gradient-hero flex items-center justify-center text-white"><Bell className="h-5 w-5" /></div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(r.fire_at), "PPp")} {r.fired && "· fired"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="rounded-full">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
