import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const logoUrl = `${import.meta.env.BASE_URL}favicon.png`;

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
    <div className="flex min-h-[100dvh] items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-8">
          <img
            src={logoUrl}
            alt="Olyxee"
            className="h-14 w-14 mb-5"
            data-testid="img-logo"
          />
          <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight">
            Welcome back
          </h1>
          <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5">
            Sign in to your Olyxee account
          </p>
        </div>

        {!isConfigured ? (
          <div
            className="text-xs text-amber-700 border border-amber-200 bg-amber-50 p-3 mb-5"
            data-testid="text-config-warning"
          >
            Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> on your deployment for sign-in
            to work.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-[13px] font-medium text-[hsl(220,20%,10%)]"
            >
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[13px] font-medium text-[hsl(220,20%,10%)]"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-password"
            />
          </div>

          {error ? (
            <div
              className="text-[13px] text-red-600 border border-red-200 bg-red-50 p-3"
              data-testid="text-error"
            >
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px]"
            data-testid="button-signin"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-[14px] text-center text-[hsl(220,9%,46%)] mt-7">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="text-[hsl(220,20%,10%)] font-medium hover:underline"
          >
            Create one
          </Link>
        </p>

        <p className="text-[10px] text-center text-[hsl(220,9%,60%)] mt-10 tracking-[0.15em] uppercase">
          Powered by Olyxee
        </p>
        <input type="hidden" name="basePath" value={basePath} />
      </div>
    </div>
  );
}
