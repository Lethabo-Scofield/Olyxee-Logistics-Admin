import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const logoUrl = `${import.meta.env.BASE_URL}favicon.png`;

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
            Create your account
          </h1>
          <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5">
            Get started with the Logistics Admin Panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="fullName"
              className="text-[13px] font-medium text-[hsl(220,20%,10%)]"
            >
              Full name
            </Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-fullname"
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-password"
            />
            <p className="text-[12px] text-[hsl(220,9%,46%)]">
              Use 8 or more characters with a mix of letters and numbers.
            </p>
          </div>

          {error ? (
            <div
              className="text-[13px] text-red-600 border border-red-200 bg-red-50 p-3"
              data-testid="text-error"
            >
              {error}
            </div>
          ) : null}

          {info ? (
            <div
              className="text-[13px] text-green-700 border border-green-200 bg-green-50 p-3"
              data-testid="text-info"
            >
              {info}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px]"
            data-testid="button-signup"
          >
            {submitting ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-[12px] text-center text-[hsl(220,9%,46%)]">
            By creating an account you agree to Olyxee's terms of service.
          </p>
        </form>

        <p className="text-[14px] text-center text-[hsl(220,9%,46%)] mt-7">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[hsl(220,20%,10%)] font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
