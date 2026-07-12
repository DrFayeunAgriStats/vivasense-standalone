import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ExtProfile {
  full_name?: string | null;
}

export function Header() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ExtProfile | null>(null);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles")
      .select("full_name")
      .eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data as ExtProfile | null));
  }, [user]);

  const initial = (profile?.full_name?.[0] || user?.email?.[0] || "?").toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <Sprout className="h-4 w-4" />
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight">VivaSense</span>
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:inline">
            Statistical Analysis Platform
          </span>
        </div>
      </Link>
      <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
        {initial}
      </div>
    </header>
  );
}
