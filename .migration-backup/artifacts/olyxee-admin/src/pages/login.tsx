import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    if (mode === "forgot") {
      const result = await requestPasswordReset(email);
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setInfo(
        "If an account exists for that email, we've sent a link to reset your password. Check your inbox.",
      );
      return;
    }
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
    setInfo(null);
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight text-center">
          {mode === "signin"
            ? "Welcome to Olyxee Logistics"
            : mode === "signup"
              ? "Create your account"
              : "Reset your password"}
        </h1>
        <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5 text-center">
          {mode === "signin"
            ? "Sign in to your Olyxee workspace"
            : mode === "signup"
              ? "Set up Olyxee for your business"
              : "Enter your email and we'll send you a reset link"}
        </p>
      </div>

      {mode !== "forgot" && (
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
      )}

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

        {mode !== "forgot" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Password
            </Label>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-[12px] text-[hsl(220,9%,46%)] hover:text-[hsl(220,20%,10%)] underline-offset-2 hover:underline"
                data-testid="button-forgot-password"
              >
                Forgot password?
              </button>
            )}
          </div>
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
        )}

        {info ? (
          <div
            className="text-[13px] text-emerald-700 border border-emerald-200 bg-emerald-50 p-3"
            data-testid="text-info"
          >
            {info}
          </div>
        ) : null}

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
          className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px] gap-2"
          data-testid={`button-${mode}`}
        >
          {submitting ? (
            <>
              <Spinner className="size-4 text-white" />
              {mode === "signin"
                ? "Signing in…"
                : mode === "signup"
                  ? "Creating account…"
                  : "Sending reset link…"}
            </>
          ) : mode === "signin" ? (
            "Sign in"
          ) : mode === "signup" ? (
            "Create account"
          ) : (
            "Send reset link"
          )}
        </Button>

        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="block mx-auto text-[13px] text-[hsl(220,9%,46%)] hover:text-[hsl(220,20%,10%)] underline-offset-2 hover:underline"
            data-testid="button-back-to-signin"
          >
            Back to sign in
          </button>
        )}
      </form>

      <p className="text-[10px] text-center text-[hsl(220,9%,60%)] mt-10 tracking-[0.15em] uppercase">
        Powered by Olyxee
      </p>
    </AuthLayout>
  );
}
