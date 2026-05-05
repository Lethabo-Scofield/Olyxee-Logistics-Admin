import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = await signUp(email, password, fullName);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setInfo("Check your inbox for a confirmation link to finish signing up.");
      return;
    }
    setLocation("/dashboard");
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="w-[440px] max-w-full bg-white border border-[hsl(220,13%,88%)] p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="h-10 w-10 bg-[hsl(220,20%,10%)] flex items-center justify-center mb-3">
            <span className="text-white font-bold">O</span>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(220,20%,10%)]">
            Create your account
          </h1>
          <p className="text-sm text-[hsl(220,9%,46%)] mt-1">
            Get started with Olyxee Logistics
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              data-testid="input-fullname"
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
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
          {info ? (
            <div
              className="text-sm text-green-700 border border-green-200 bg-green-50 p-2"
              data-testid="text-info"
            >
              {info}
            </div>
          ) : null}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white"
            data-testid="button-signup"
          >
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-center text-[hsl(220,9%,46%)] mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[hsl(220,20%,10%)] font-medium underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
