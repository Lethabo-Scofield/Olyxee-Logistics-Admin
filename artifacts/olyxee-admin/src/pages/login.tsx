import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const logoUrl = `${import.meta.env.BASE_URL}favicon.png`;

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp({ email, password, fullName, businessName });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLocation(mode === "signup" ? "/onboarding" : "/dashboard");
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-8">
        <img src={logoUrl} alt="Olyxee" className="h-14 w-14 mb-5" data-testid="img-logo" />
        <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight text-center">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5 text-center">
          {mode === "signin"
            ? "Sign in to your Olyxee workspace"
            : "Set up Olyxee for your business"}
        </p>
      </div>

      <div
        className="flex rounded-md border border-[hsl(220,13%,90%)] p-1 mb-6 bg-[hsl(220,20%,98%)]"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => switchMode("signin")}
          className={`flex-1 h-9 text-[13px] font-medium rounded ${
            mode === "signin"
              ? "bg-white text-[hsl(220,20%,10%)] shadow-sm"
              : "text-[hsl(220,9%,46%)]"
          }`}
          data-testid="tab-signin"
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => switchMode("signup")}
          className={`flex-1 h-9 text-[13px] font-medium rounded ${
            mode === "signup"
              ? "bg-white text-[hsl(220,20%,10%)] shadow-sm"
              : "text-[hsl(220,9%,46%)]"
          }`}
          data-testid="tab-signup"
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" data-testid={`form-${mode}`}>
        {mode === "signup" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
                Your name
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
                htmlFor="businessName"
                className="text-[13px] font-medium text-[hsl(220,20%,10%)]"
              >
                Business name
              </Label>
              <Input
                id="businessName"
                type="text"
                required
                placeholder="FreightShift Logistics"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
                data-testid="input-business-name"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
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
          <Label htmlFor="password" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            placeholder={
              mode === "signup" ? "At least 8 characters" : "Enter your password"
            }
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
          data-testid={`button-${mode}`}
        >
          {submitting
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <p className="text-[10px] text-center text-[hsl(220,9%,60%)] mt-10 tracking-[0.15em] uppercase">
        Powered by Olyxee
      </p>
    </AuthLayout>
  );
}
