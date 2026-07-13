import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sprout, Mail, Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";

type Screen = "login" | "register" | "check-email";

const POSITIONS = [
  "MSc Student", "PhD Student", "Postdoctoral Researcher", "Research Scientist",
  "Lecturer", "Senior Lecturer", "Associate Professor", "Professor", "Other",
];

const SOURCES = [
  "FIA Cohort Programme", "Recommended by Lecturer", "Recommended by Friend/Colleague",
  "Social Media", "Google Search", "Website", "Other",
];

function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center mb-6">
      <div className="inline-flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-sm">
          <Sprout className="w-7 h-7 text-white" />
        </div>
        <div className="text-left">
          <div className="text-2xl font-bold text-foreground leading-tight">VivaSense</div>
          <div className="text-xs text-muted-foreground">Agricultural Statistics Platform</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Field-to-Insight Academy</p>
      <p className="text-sm text-foreground/80 mt-3">{subtitle}</p>
    </div>
  );
}

export default function VivaSenseAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [screen, setScreen] = useState<Screen>(params.get("mode") === "register" ? "register" : "login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [institution, setInstitution] = useState("");
  const [position, setPosition] = useState("");
  const [researchArea, setResearchArea] = useState("");
  const [registrationSource, setRegistrationSource] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms1, setTerms1] = useState(false);
  const [terms2, setTerms2] = useState(false);
  const [terms3, setTerms3] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(params.get("next") || "/workspace", { replace: true });
    }
  }, [user, authLoading, navigate, params]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      setError(signInErr.message.includes("Email not confirmed")
        ? "Please verify your email first. Check your inbox for the verification link."
        : "Invalid email or password.");
      setLoading(false); return;
    }
    const { data: profile } = await supabase
      .from("profiles").select("access_status, login_count").eq("id", data.user.id).maybeSingle();
    if ((profile as any)?.access_status === "suspended") {
      setError("Your account has been suspended. Contact support.");
      await supabase.auth.signOut();
      setLoading(false); return;
    }
    await supabase.from("profiles").update({
      last_login: new Date().toISOString(),
      login_count: ((profile as any)?.login_count || 0) + 1,
    } as any).eq("id", data.user.id);
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email address first"); return; }
    setError("");
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (e) setError(e.message);
    else setMessage("Password reset email sent. Check your inbox.");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setMessage("");
    if (password !== confirmPassword) { setError("Passwords do not match"); setLoading(false); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); setLoading(false); return; }

    const { error: signUpErr } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          full_name: fullName, institution, position,
          research_area: researchArea, registration_source: registrationSource,
          cohort: "general", terms_accepted: true,
          platform_source: "vivasense",
        },
        emailRedirectTo: `${window.location.origin}/workspace`,
      },
    });
    if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }
    setScreen("check-email");
    setLoading(false);
  };

  const handleResend = async () => {
    setError(""); setMessage("");
    const { error: e } = await supabase.auth.resend({ type: "signup", email });
    if (e) setError(e.message);
    else setMessage("Verification email resent.");
  };

  const allTerms = terms1 && terms2 && terms3;
  const passwordStrength = password.length >= 12 ? "Strong" : password.length >= 8 ? "Medium" : password.length > 0 ? "Weak" : "";
  const strengthColor = passwordStrength === "Strong" ? "text-primary" : passwordStrength === "Medium" ? "text-amber-600" : "text-red-600";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl border border-border shadow-sm p-8">
          {screen === "login" && (
            <>
              <BrandHeader subtitle="Sign in to your workspace" />
              <form onSubmit={handleLogin} className="space-y-4">
                <FormField label="Email">
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </FormField>
                <FormField label="Password">
                  <PasswordInput value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword(s => !s)} />
                </FormField>
                {error && <Alert kind="error">{error}</Alert>}
                {message && <Alert kind="success">{message}</Alert>}
                <button type="submit" disabled={loading} className={primaryBtn}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />}
                  Sign In
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={handleForgotPassword} className="text-primary hover:underline">
                    Forgot password?
                  </button>
                  <button type="button" onClick={() => { setScreen("register"); setError(""); setMessage(""); }} className="text-primary hover:underline font-medium">
                    Register free →
                  </button>
                </div>
              </form>
            </>
          )}

          {screen === "register" && (
            <>
              <BrandHeader subtitle="Create your free account" />
              <form onSubmit={handleRegister} className="space-y-3">
                <FormField label="Full Name *">
                  <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
                </FormField>
                <FormField label="Email Address *">
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </FormField>
                <FormField label="Institution / University *">
                  <input required value={institution} onChange={(e) => setInstitution(e.target.value)} className={inputCls} />
                </FormField>
                <FormField label="Position *">
                  <select required value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls}>
                    <option value="">Select position...</option>
                    {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </FormField>
                <FormField label="Research Area *">
                  <input required value={researchArea} onChange={(e) => setResearchArea(e.target.value)}
                    placeholder="e.g. Plant Breeding, Agronomy, Soil Science" className={inputCls} />
                </FormField>
                <FormField label="How did you hear about VivaSense? *">
                  <select required value={registrationSource} onChange={(e) => setRegistrationSource(e.target.value)} className={inputCls}>
                    <option value="">Select...</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Password *">
                  <PasswordInput value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword(s => !s)} />
                  {passwordStrength && <p className={`text-xs mt-1 ${strengthColor}`}>Strength: {passwordStrength}</p>}
                </FormField>
                <FormField label="Confirm Password *">
                  <PasswordInput value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(s => !s)} />
                </FormField>

                <div className="space-y-2 pt-2">
                  <TermsBox checked={terms1} onChange={setTerms1}
                    text="I understand that VivaSense is an educational and research-support platform. Statistical outputs should be interpreted by a qualified researcher." />
                  <TermsBox checked={terms2} onChange={setTerms2}
                    text="Scientific conclusions remain the sole responsibility of the researcher. VivaSense supports but does not replace expert judgment." />
                  <label className="flex items-start gap-2 text-xs text-foreground/80">
                    <input type="checkbox" checked={terms3} onChange={(e) => setTerms3(e.target.checked)} className="mt-1 accent-primary" />
                    <span>
                      I agree to the{" "}
                      <a href="#" className="text-primary underline">Terms of Use</a>
                      {" "}and{" "}
                      <a href="#" className="text-primary underline">Privacy Policy</a>
                      {" "}of Field-to-Insight Academy.
                    </span>
                  </label>
                </div>

                {error && <Alert kind="error">{error}</Alert>}

                <button type="submit" disabled={loading || !allTerms} className={primaryBtn}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />}
                  {loading ? "Creating account..." : "Create Free Account →"}
                </button>

                <button type="button" onClick={() => { setScreen("login"); setError(""); setMessage(""); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground">
                  Already have an account? Sign in
                </button>
              </form>
            </>
          )}

          {screen === "check-email" && (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Check Your Email!</h2>
              <p className="text-sm text-muted-foreground mb-2">We sent a verification link to:</p>
              <p className="font-medium text-foreground mb-6">{email}</p>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-left mb-4">
                <p className="text-sm font-semibold text-foreground mb-2">Next steps:</p>
                <ol className="text-sm text-foreground/80 space-y-1 list-decimal list-inside">
                  <li>Open your email inbox</li>
                  <li>Find email from VivaSense</li>
                  <li>Click the "Verify Email" link</li>
                  <li>You'll be redirected to VivaSense</li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Didn't receive it? Check your spam folder.</p>
              {error && <Alert kind="error">{error}</Alert>}
              {message && <Alert kind="success">{message}</Alert>}
              <button onClick={handleResend} className="text-sm text-primary hover:underline">Resend verification email</button>
              <div className="mt-4">
                <button onClick={() => setScreen("login")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back to login
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          © 2026 Field-to-Insight Academy · vivasensestat.com
        </p>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring text-sm";
const primaryBtn = "w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground font-medium py-2.5 rounded-md transition-colors";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Alert({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  const cls = kind === "error"
    ? "bg-red-50 border border-red-200 text-red-700"
    : "bg-primary/5 border border-primary/20 text-primary";
  return <div className={`${cls} text-sm px-3 py-2 rounded-lg`}>{children}</div>;
}

function TermsBox({ checked, onChange, text }: { checked: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <label className="flex items-start gap-2 text-xs text-foreground/80">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-primary" />
      <span>{text}</span>
    </label>
  );
}

function PasswordInput({ value, onChange, visible, onToggle }: { value: string; onChange: (v: string) => void; visible: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
