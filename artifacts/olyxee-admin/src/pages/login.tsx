import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LoginPage() {
  const { signIn, isConfigured } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setLocation("/dashboard");
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="w-[440px] max-w-full bg-white border border-[hsl(220,13%,88%)] p-8">
        {!isConfigured ? (
          <div
            className="text-xs text-amber-700 border border-amber-200 bg-amber-50 p-3 mb-4"
            data-testid="text-config-warning"
          >
            Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> on your deployment for sign-in
            to work.
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-password"
            />
          </div>
          {error ? (
            <div
              className="text-sm text-red-600 border border-red-200 bg-red-50 p-2"
              data-testid="text-error"
            >
              {error}
            </div>
          ) : null}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white"
            data-testid="button-signin"
          >
            {submitting ? "Signing in…" : "Continue"}
          </Button>
        </form>

        <p className="text-sm text-center text-[hsl(220,9%,46%)] mt-6">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="text-[hsl(220,20%,10%)] font-medium underline"
          >
            Sign up
          </Link>
        </p>
        <p className="text-[10px] text-center text-[hsl(220,9%,46%)] mt-4 tracking-widest uppercase">
          Powered by Olyxee
        </p>
        <input type="hidden" name="basePath" value={basePath} />
      </div>
    </div>
  );
}
