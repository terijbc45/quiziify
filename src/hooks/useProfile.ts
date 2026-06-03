import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type ProfileLite = {
  display_name: string;
  country: string | null;
  grade: string | null;
  avatar_url: string | null;
};

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("profiles").select("display_name,country,grade,avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setProfile({ ...(data as ProfileLite), country: (data as ProfileLite).country ?? "np" });
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("display_name,country,grade,avatar_url").eq("id", user.id).maybeSingle();
    if (data) setProfile({ ...(data as ProfileLite), country: (data as ProfileLite).country ?? "np" });
  };

  return { profile, loading, refresh };
}
