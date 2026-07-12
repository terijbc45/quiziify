import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type ProfileLite = {
  display_name: string;
  country: string | null;
  grade: string | null;
  avatar_url: string | null;
  optional_subjects: string[];
};

const SELECT = "display_name,country,grade,avatar_url,optional_subjects";

function normalize(data: any): ProfileLite {
  return {
    display_name: data.display_name,
    country: data.country ?? "np",
    grade: data.grade ?? null,
    avatar_url: data.avatar_url ?? null,
    optional_subjects: Array.isArray(data.optional_subjects) ? data.optional_subjects : [],
  };
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("profiles").select(SELECT).eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setProfile(normalize(data));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select(SELECT).eq("id", user.id).maybeSingle();
    if (data) setProfile(normalize(data));
  };

  return { profile, loading, refresh };
}
