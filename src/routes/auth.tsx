import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMfaState, verifyMfaCode } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/SiteHeader";
import { Loader2, Sparkle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to yLearn" },
      {
        name: "description",
        content: "Create a free yLearn account to generate AI flashcards and track your streak.",
      },
      { property: "og:title", content: "Sign in to yLearn" },
      { property: "og:description", content: "Free AI flashcards for middle and high school." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const finishAuthentication = useCallback(async () => {
    const mfa = await getMfaState();
    if (mfa.required && mfa.factor) {
      setMfaFactorId(mfa.factor.id);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }, [navigate]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data.session) {
        finishAuthentication().catch((err) => {
          toast.error(err instanceof Error ? err.message : "Could not verify your account.");
        });
      }
    });
  }, [finishAuthentication]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        await finishAuthentication();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await finishAuthentication();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setBusy(true);
    try {
      await verifyMfaCode(mfaFactorId, mfaCode.replace(/\s/g, ""));
      await finishAuthentication();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid authentication code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setBusy(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
  }

  return (
    <div className="glow-grid flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl shadow-black/30 sm:p-8">
        {mfaFactorId ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <h1 className="text-2xl font-bold">Two-factor authentication</h1>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-code">Authentication code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,8}"
                maxLength={8}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                required
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={busy || mfaCode.replace(/\s/g, "").length < 6}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify code
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setMfaFactorId(null);
                setMfaCode("");
                supabase.auth.signOut();
              }}
            >
              Use a different account
            </button>
          </form>
        ) : sent ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold">Check your inbox</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We sent a confirmation link to <span className="text-foreground">{email}</span>. Click
              it to activate your account, then come back and sign in.
            </p>
            <Button
              className="mt-6 w-full"
              variant="secondary"
              onClick={() => {
                setSent(false);
                setMode("signin");
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">
              {mode === "signin" ? "Welcome back" : "Start learning smarter"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to reach your sets and keep your streak alive."
                : "Free account. Generate your first set in under a minute."}
            </p>

            <Button
              type="button"
              variant="secondary"
              className="mt-6 w-full"
              onClick={handleGoogle}
              disabled={busy}
            >
              Continue with Google
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkle className="h-4 w-4" />
                )}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "New to yLearn?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </div>

      <Link to="/explore" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
        Browse community sets without an account
      </Link>
    </div>
  );
}
