import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Loader2,
  LogOut,
  KeyRound,
  ChevronDown,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

// Self-service profile editing for the signed-in admin: name, email,
// and password. Reachable from the sidebar (click your name) or /profile.
//
// UX choices:
//  - Big avatar + identity card at the top so you see "this is me" instantly.
//  - Password is collapsed by default behind a "Change password" toggle —
//    most visits are just to update name/email.
//  - Live, inline feedback for password strength + match so users don't have
//    to guess why Save is disabled.
//  - Sign-out lives here too as a convenience (it's also in the sidebar).
export default function ProfilePage() {
  const { user, updateProfile, signOut } = useAuth();
  const [, setLocation] = useLocation();

  // ── Account info ─────────────────────────────────────────────
  const [info, setInfo] = useState({ name: "", email: "" });
  const [loaded, setLoaded] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Password ─────────────────────────────────────────────────
  const [showPwdSection, setShowPwdSection] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (user && !loaded) {
      setInfo({ name: user.name, email: user.email });
      setLoaded(true);
    }
  }, [user, loaded]);

  const infoDirty =
    loaded && user != null && (info.name !== user.name || info.email !== user.email);

  // Cheap-and-cheerful password strength: rewards length and character variety.
  // Returns 0..4 (Weak → Strong). Pure UX hint — server still enforces rules.
  const pwdStrength = useMemo(() => {
    const p = pwd.next;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
    return Math.min(4, score);
  }, [pwd.next]);

  const strengthMeta = [
    { label: "Too short", color: "bg-muted" },
    { label: "Weak", color: "bg-red-500" },
    { label: "Fair", color: "bg-amber-500" },
    { label: "Good", color: "bg-emerald-500" },
    { label: "Strong", color: "bg-emerald-600" },
  ][pwdStrength];

  const pwdMatchState: "idle" | "match" | "mismatch" =
    !pwd.confirm ? "idle" : pwd.confirm === pwd.next ? "match" : "mismatch";

  const canChangePwd =
    pwd.current.length > 0 &&
    pwd.next.length >= 8 &&
    pwd.confirm.length > 0 &&
    pwdMatchState === "match";

  const handleSaveInfo = async () => {
    if (!info.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!info.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSavingInfo(true);
    const result = await updateProfile({
      name: info.name.trim(),
      email: info.email.trim(),
    });
    setSavingInfo(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Profile updated");
    }
  };

  const handleChangePassword = async () => {
    if (!canChangePwd) return;
    setSavingPwd(true);
    const result = await updateProfile({
      currentPassword: pwd.current,
      newPassword: pwd.next,
    });
    setSavingPwd(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Password changed");
      setPwd({ current: "", next: "", confirm: "" });
      setShowPwd({ current: false, next: false, confirm: false });
      setShowPwdSection(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  if (!user) return null;

  const fullName = user.name || user.email;
  const initial = (fullName || "U").charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      {/* ─── Identity card ──────────────────────────────────────── */}
      <header className="flex items-center gap-4 border border-border bg-card p-5">
        <Avatar className="h-16 w-16 flex-shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{fullName}</h1>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              {user.role}
            </Badge>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500">
              <span className="h-1.5 w-1.5 bg-emerald-500 inline-block" />
              Signed in
            </span>
          </div>
        </div>
      </header>

      {/* ─── Account info form ──────────────────────────────────── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Account details</Label>
          <p className="text-xs text-muted-foreground">
            These are saved as soon as you hit Save — no waiting.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profileName" className="text-xs font-normal text-muted-foreground">
            Full name
          </Label>
          <Input
            id="profileName"
            value={info.name}
            onChange={(e) => setInfo((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Jane Smith"
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profileEmail" className="text-xs font-normal text-muted-foreground">
            Email
          </Label>
          <Input
            id="profileEmail"
            type="email"
            value={info.email}
            onChange={(e) => setInfo((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
            className="h-11"
          />
          <p className="text-[11px] text-muted-foreground">Used to sign in.</p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <span
            className={cn(
              "text-xs transition-opacity",
              infoDirty ? "text-amber-600 dark:text-amber-500 opacity-100" : "opacity-0",
            )}
            aria-live="polite"
          >
            {infoDirty ? "You have unsaved changes." : ""}
          </span>
          <Button
            size="sm"
            onClick={handleSaveInfo}
            disabled={!infoDirty || savingInfo}
            className="gap-1.5"
          >
            {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {savingInfo ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>

      {/* ─── Password (collapsed by default) ─────────────────────── */}
      <section className="border-t pt-8">
        {!showPwdSection ? (
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Password</Label>
              <p className="text-xs text-muted-foreground">
                Last changed: kept private. Update it any time.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowPwdSection(true)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Change password
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Change password</Label>
                <p className="text-xs text-muted-foreground">
                  Pick something at least 8 characters. Longer is stronger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPwdSection(false);
                  setPwd({ current: "", next: "", confirm: "" });
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            <PasswordField
              id="pwdCurrent"
              label="Current password"
              value={pwd.current}
              onChange={(v) => setPwd((p) => ({ ...p, current: v }))}
              visible={showPwd.current}
              onToggleVisible={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
              autoComplete="current-password"
            />

            <PasswordField
              id="pwdNext"
              label="New password"
              value={pwd.next}
              onChange={(v) => setPwd((p) => ({ ...p, next: v }))}
              visible={showPwd.next}
              onToggleVisible={() => setShowPwd((s) => ({ ...s, next: !s.next }))}
              autoComplete="new-password"
            />

            {/* Strength meter — appears only while typing */}
            {pwd.next.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 transition-colors",
                        i <= pwdStrength ? strengthMeta.color : "bg-muted",
                      )}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Strength: <span className="text-foreground font-medium">{strengthMeta.label}</span>
                </p>
              </div>
            )}

            <PasswordField
              id="pwdConfirm"
              label="Confirm new password"
              value={pwd.confirm}
              onChange={(v) => setPwd((p) => ({ ...p, confirm: v }))}
              visible={showPwd.confirm}
              onToggleVisible={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
              autoComplete="new-password"
              hint={
                pwdMatchState === "match" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                    <Check className="h-3 w-3" /> Passwords match
                  </span>
                ) : pwdMatchState === "mismatch" ? (
                  <span className="text-red-600 dark:text-red-500">Passwords don't match yet.</span>
                ) : null
              }
            />

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleChangePassword}
                disabled={!canChangePwd || savingPwd}
                className="gap-1.5"
              >
                {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {savingPwd ? "Updating…" : "Update password"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ─── Sign out ───────────────────────────────────────────── */}
      <section className="border-t pt-6 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Sign out</Label>
          <p className="text-xs text-muted-foreground">
            End your session on this device.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </section>
    </div>
  );
}

// ─── Password field with show/hide toggle ─────────────────────────────────────
// Local helper so each password input has a consistent eye-toggle + optional
// inline hint underneath (for the match indicator). Avoids three near-identical
// blocks in the main component.
function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="h-11 pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleVisible}
          className="absolute right-0 top-0 h-11 w-10 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint ? <p className="text-[11px]">{hint}</p> : null}
    </div>
  );
}
