import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Brain, Home, Bell, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { startReminderEngine, stopReminderEngine } from "@/lib/reminder-engine";
import { AlarmOverlay } from "./AlarmOverlay";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [alarm, setAlarm] = useState<null | { id: string; title: string; body: string | null; thumbnail_url: string | null }>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [initial, setInitial] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    startReminderEngine(user.id, (r) => setAlarm(r));
    supabase.from("profiles").select("avatar_url,display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setAvatar(data?.avatar_url ?? null);
        setInitial((data?.display_name ?? "?").slice(0, 1).toUpperCase());
      });
    return () => stopReminderEngine();
  }, [user, loading, nav]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const tabs = [
    { to: "/", label: "Home", icon: Home },
    { to: "/create", label: "Create", icon: Plus },
    { to: "/reminders", label: "Reminders", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-soft">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gradient">Quiz</span>
          </Link>
          <Link
            to="/profile"
            aria-label="Profile"
            className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-border hover:ring-primary transition-all flex items-center justify-center bg-gradient-hero text-white font-bold"
          >
            {avatar ? (
              <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-28">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-background/90 border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-3">
          {tabs.map((t) => {
            const active = loc.pathname === t.to || (t.to !== "/" && loc.pathname.startsWith(t.to));
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-1 py-3 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {alarm && <AlarmOverlay reminder={alarm} onDismiss={() => setAlarm(null)} />}
    </div>
  );
}
