import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Lock, Mail, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

const schema = z.object({
  email: z.string().email("Enter a valid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
  displayName: z.string().trim().min(1).max(40).optional(),
  country: z.string().min(2).max(8).optional(),
  grade: z.string().min(1).max(20).optional(),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) nav({ to: "/" }); }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && (!country || !grade)) {
      toast.error("Please choose your country and class");
      return;
    }
    const parsed = schema.safeParse({ email, password, displayName: mode === "signup" ? displayName : undefined, country: mode === "signup" ? country : undefined, grade: mode === "signup" ? grade : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signUp, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        // Persist country/grade to profile (handle_new_user trigger creates the row).
        if (signUp.user) {
          await supabase.from("profiles").update({ country, grade }).eq("id", signUp.user.id);
        }
        toast.success("Account created! You're in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-white">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center mb-4 shadow-glow">
            <Brain className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold">Quiziify</h1>
          <p className="text-white/80 mt-2">Sharpen your mind, your curriculum, your way.</p>
        </div>

        <div className="bg-card rounded-3xl shadow-glow p-7 animate-slide-in">
          <div className="flex gap-1 p-1 bg-muted rounded-full mb-6">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${
                  mode === m ? "bg-card text-primary shadow-card" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="dn">Display name</Label>
                <div className="relative">
                  <Sparkles className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex" className="pl-9 h-11 rounded-xl" maxLength={40} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="e">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9 h-11 rounded-xl" autoComplete="email" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="pl-9 h-11 rounded-xl" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={8} />
              </div>
            </div>

            <Button type="submit" disabled={busy} className="w-full h-11 rounded-xl bg-gradient-hero hover:opacity-90 font-semibold shadow-soft">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" /> OR <div className="flex-1 h-px bg-border" />
          </div>

          <Button onClick={google} variant="outline" disabled={busy} className="w-full h-11 rounded-xl gap-2 font-medium">
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Shield className="h-3.5 w-3.5" />
            Secured with bank-grade encryption
          </div>
        </div>
      </div>
    </div>
  );
}
