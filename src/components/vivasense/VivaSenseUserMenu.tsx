import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExtProfile {
  full_name?: string | null;
  email?: string | null;
  position?: string | null;
  institution?: string | null;
  login_count?: number | null;
  created_at?: string | null;
}

export function VivaSenseUserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ExtProfile | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles")
      .select("full_name, email, position, institution, login_count, created_at")
      .eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data as ExtProfile | null));
  }, [user]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) {
    return (
      <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted">
        <Link to="/auth">Sign in</Link>
      </Button>
    );
  }

  const initial = (profile?.full_name?.[0] || user.email?.[0] || "?").toUpperCase();
  const firstName = profile?.full_name?.split(" ")[0] || "Account";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
          {initial}
        </div>
        <span className="text-sm font-medium text-foreground hidden sm:inline">{firstName}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-background rounded-xl shadow-lg border border-border z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <div className="font-semibold text-foreground text-sm truncate">{profile?.full_name || "—"}</div>
            {profile?.position && <div className="text-xs text-muted-foreground mt-0.5">{profile.position}</div>}
            {profile?.institution && <div className="text-xs text-muted-foreground mt-0.5 truncate">{profile.institution}</div>}
            <div className="text-xs text-muted-foreground mt-1 truncate">{profile?.email || user.email}</div>
          </div>
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Logins</span><span className="font-semibold text-foreground">{profile?.login_count ?? 0}</span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between mt-0.5">
              <span>Member since</span>
              <span className="font-semibold text-foreground">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
          <div className="p-1">
            <button onClick={() => { setOpen(false); navigate("/workspace"); }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors">
              <User className="w-4 h-4" /> My Workspace
            </button>
            <button onClick={async () => { setOpen(false); await signOut(); navigate("/auth"); }}
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg flex items-center gap-2 transition-colors">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
