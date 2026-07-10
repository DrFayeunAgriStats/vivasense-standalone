import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, Loader2 } from "lucide-react";

export function VivaSenseAuthGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [resilienceChecked, setResilienceChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setResilienceChecked(true);
      return;
    }

    const checkProfile = async () => {
      try {
        const { error } = await supabase
          .from("profiles")
          .select("platform_source")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.warn(
            "VivaSenseAuthGuard: non-blocking profile check error:",
            error.message
          );
        }
      } catch (err) {
        console.warn(
          "VivaSenseAuthGuard: non-blocking unexpected error:",
          err
        );
      } finally {
        setResilienceChecked(true);
      }
    };

    void checkProfile();
  }, [user]);

  if (authLoading || (user && !resilienceChecked)) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-green-700 flex items-center justify-center">
          <Sprout className="w-7 h-7 text-white" />
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-green-700" />
        <p className="text-sm text-green-800">Loading VivaSense...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}
