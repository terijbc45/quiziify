import { supabase } from "@/integrations/supabase/client";

type FireFn = (r: { id: string; title: string; body: string | null; thumbnail_url: string | null }) => void;

let timer: ReturnType<typeof setInterval> | null = null;

export function startReminderEngine(userId: string, onFire: FireFn) {
  if (timer) clearInterval(timer);

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  const tick = async () => {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .eq("fired", false)
      .lte("fire_at", nowIso)
      .order("fire_at", { ascending: true })
      .limit(1);

    if (data && data[0]) {
      const r = data[0];
      await supabase.from("reminders").update({ fired: true }).eq("id", r.id);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(r.title, { body: r.body ?? "", icon: r.thumbnail_url ?? "/icon-192.png" });
        } catch {}
      }
      onFire(r);
    }
  };

  tick();
  timer = setInterval(tick, 5000);
}

export function stopReminderEngine() {
  if (timer) clearInterval(timer);
  timer = null;
}
