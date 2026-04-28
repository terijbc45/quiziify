import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Brain, Home, Bell, User, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { startReminderEngine, stopReminderEngine } from "@/lib/reminder-engine";
import { AlarmOverlay } from "./AlarmOverlay";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [alarm, setAlarm] = useState<null | { id: string; title: string; body: string | null; thumbnail_url: string | null }>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    startReminderEngine(user.id, (r) => setAlarm(r));
    return () => stopReminderEngine();
  }, [user, loading, nav]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const tabs = [
    { to: "/", label: "Home", icon: Home },
    { to: "/create", label: "Create", icon: Plus },
    { to: "/reminders", label: "Reminders", icon: Bell },
    { to: "/profile", label: "Profile", icon: User },
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
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-28">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-background/90 border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-4">
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
