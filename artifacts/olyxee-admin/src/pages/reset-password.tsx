import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [, setLocation] = useLocation();

  // Read ?token=... from the URL. We use window.location.search rather than a
  // route param so the link in the email can stay simple.
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("token") ?? "";
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("This reset link is missing its token. Request a new one.");
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const result = await resetPassword({ token, password });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight text-center">
          {done ? "Password updated" : "Choose a new password"}
        </h1>
        <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5 text-center">
          {done
            ? "You can now sign in with your new password."
            : "Enter a new password for your Olyxee account."}
        </p>
      </div>

      {done ? (
        <Button
          type="button"
          onClick={() => setLocation("/login")}
          className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px]"
          data-testid="button-go-signin"
        >
          Go to sign in
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-reset">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!token}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Confirm password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Re-enter your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!token}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-confirm-password"
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
            disabled={submitting || !token}
            className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px] gap-2"
            data-testid="button-reset"
          >
            {submitting ? (
              <>
                <Spinner className="size-4 text-white" />
                Updating password…
              </>
            ) : (
              "Update password"
            )}
          </Button>

          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="block mx-auto text-[13px] text-[hsl(220,9%,46%)] hover:text-[hsl(220,20%,10%)] underline-offset-2 hover:underline"
            data-testid="button-back-to-signin"
          >
            Back to sign in
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
