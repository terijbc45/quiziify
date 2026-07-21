import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brain, Shield } from "lucide-react";

type AuthDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string };
  scope?: string;
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
};

// Local wrapper for the beta supabase.auth.oauth namespace.
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};
const oauthNs = () => (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold mb-2">Could not load this authorization request</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauthNs().approveAuthorization(authorization_id)
      : await oauthNs().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-glow p-7">
        <div className="text-center mb-5">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Brain className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Connect {clientName} to your Quiziify account</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {clientName} will be able to call Quiziify's enabled tools while you are signed in.
          </p>
        </div>

        <div className="rounded-xl bg-muted/50 p-4 text-sm space-y-2 mb-5">
          <div><span className="font-medium">Share your basic profile</span></div>
          <div><span className="font-medium">Access your reminders, posts, and quiz history</span></div>
          <p className="text-xs text-muted-foreground pt-1">
            This does not bypass Quiziify's permissions or backend policies.
          </p>
        </div>

        {error && <p role="alert" className="text-sm text-destructive mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)} className="flex-1 h-11 rounded-xl">
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => decide(true)} className="flex-1 h-11 rounded-xl bg-gradient-hero font-semibold">
            {busy ? "Please wait…" : "Approve"}
          </Button>
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <Shield className="h-3.5 w-3.5" /> Secured with OAuth 2.1
        </div>
      </div>
    </main>
  );
}
