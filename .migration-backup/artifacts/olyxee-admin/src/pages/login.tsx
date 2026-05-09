import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}favicon.png`;

type Step = "email" | "signin" | "signup";

export default function LoginPage() {
  const { signIn, signUp, checkEmailExists, isConfigured } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleEmailContinue(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = await checkEmailExists(email);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.fallback) {
      // Server can't enumerate accounts (no service-role key configured).
      // Default to the sign-in form so existing users aren't dead-ended; the
      // copy below the form lets them switch to "create account" if needed.
      setInfo("Enter your password to sign in. New here? Use 'Create account' below.");
      setStep("signin");
      return;
    }
    setStep(result.exists ? "signin" : "signup");
  }

  async function handleSignIn(e: FormEvent) {
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

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = await signUp(email, password, fullName, businessName);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setInfo(
        "Check your inbox for a confirmation link. Once confirmed, sign in to finish setting up your business.",
      );
      return;
    }
    // The auth provider flips to authenticated; the route guard will route
    // them to /onboarding because the new business has onboardingCompleted=false.
    setLocation("/onboarding");
  }

  function resetToEmail() {
    setStep("email");
    setError(null);
    setInfo(null);
    setPassword("");
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-8">
        <img src={logoUrl} alt="Olyxee" className="h-14 w-14 mb-5" data-testid="img-logo" />
        <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight text-center">
          {step === "email" && "Welcome to Olyxee"}
          {step === "signin" && "Welcome back"}
          {step === "signup" && "Create your business account"}
        </h1>
        <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5 text-center">
          {step === "email" && "Enter your email to continue"}
          {step === "signin" && email}
          {step === "signup" && `Setting up Olyxee for ${email}`}
        </p>
      </div>

      {!isConfigured ? (
        <div
          className="text-xs text-amber-700 border border-amber-200 bg-amber-50 p-3 mb-5"
          data-testid="text-config-warning"
        >
          Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> on your deployment for sign-in to work.
        </div>
      ) : null}

      {step === "email" && (
        <form onSubmit={handleEmailContinue} className="space-y-5" data-testid="form-email">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-email"
            />
          </div>

          {error ? (
            <div className="text-[13px] text-red-600 border border-red-200 bg-red-50 p-3" data-testid="text-error">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting || !email}
            className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px]"
            data-testid="button-continue"
          >
            {submitting ? "Checking…" : "Continue"}
          </Button>
        </form>
      )}

      {step === "signin" && (
        <form onSubmit={handleSignIn} className="space-y-5" data-testid="form-signin">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-password"
            />
          </div>

          {error ? (
            <div className="text-[13px] text-red-600 border border-red-200 bg-red-50 p-3" data-testid="text-error">
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

          <div className="flex items-center justify-between text-[13px]">
            <button
              type="button"
              onClick={resetToEmail}
              className="text-[hsl(220,9%,46%)] hover:text-[hsl(220,20%,10%)] inline-flex items-center gap-1.5"
              data-testid="button-back-email"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("signup");
                setError(null);
                setInfo(null);
                setPassword("");
              }}
              className="text-[hsl(220,9%,46%)] hover:text-[hsl(220,20%,10%)]"
              data-testid="button-switch-signup"
            >
              Create account instead
            </button>
          </div>

          {info ? (
            <div
              className="text-[13px] text-[hsl(220,20%,40%)] border border-[hsl(220,13%,90%)] bg-[hsl(220,20%,98%)] p-3"
              data-testid="text-info"
            >
              {info}
            </div>
          ) : null}
        </form>
      )}

      {step === "signup" && (
        <form onSubmit={handleSignUp} className="space-y-5" data-testid="form-signup">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Your name
            </Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              autoFocus
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-fullname"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
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

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
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
          </div>

          {error ? (
            <div className="text-[13px] text-red-600 border border-red-200 bg-red-50 p-3" data-testid="text-error">
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
            data-testid="button-create-account"
          >
            {submitting ? "Creating account…" : "Create business account"}
          </Button>

          <p className="text-[12px] text-center text-[hsl(220,9%,46%)]">
            By creating an account you agree to Olyxee's terms of service.
          </p>

          <button
            type="button"
            onClick={resetToEmail}
            className="text-[13px] text-[hsl(220,9%,46%)] hover:text-[hsl(220,20%,10%)] inline-flex items-center gap-1.5"
            data-testid="button-back-email"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
          </button>
        </form>
      )}

      <p className="text-[10px] text-center text-[hsl(220,9%,60%)] mt-10 tracking-[0.15em] uppercase">
        Powered by Olyxee
      </p>
    </AuthLayout>
  );
}
