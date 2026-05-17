import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";

// Self-service profile editing for the signed-in admin: name, email,
// and password. Lives at /profile (reachable by clicking your name in
// the sidebar). Backed by PUT /auth/me via the auth context.
export default function ProfilePage() {
  const { user, updateProfile } = useAuth();

  const [info, setInfo] = useState({ name: "", email: "" });
  const [loaded, setLoaded] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (user && !loaded) {
      setInfo({ name: user.name, email: user.email });
      setLoaded(true);
    }
  }, [user, loaded]);

  const infoDirty =
    loaded && user != null && (info.name !== user.name || info.email !== user.email);

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
    if (!pwd.current) {
      toast.error("Enter your current password");
      return;
    }
    if (pwd.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast.error("New passwords don't match");
      return;
    }
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
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <header className="mb-10 text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground mt-1.5 text-[15px]">
          The account you're signed in as. Changes apply immediately.
        </p>
      </header>

      <div className="space-y-10">
        {/* ─── Account info ─────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profileName" className="text-xs font-normal text-muted-foreground">
              Full name
            </Label>
            <Input
              id="profileName"
              value={info.name}
              onChange={(e) => setInfo((f) => ({ ...f, name: e.target.value }))}
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
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              Used to sign in. Role: <span className="font-medium text-foreground">{user.role}</span>.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveInfo}
              disabled={!infoDirty || savingInfo}
              className="gap-1.5"
            >
              {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save profile
            </Button>
          </div>
        </section>

        {/* ─── Change password ──────────────────────────────────── */}
        <section className="space-y-4 border-t pt-8">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Change password</Label>
            <p className="text-xs text-muted-foreground">
              Leave blank if you don't want to change it.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pwdCurrent" className="text-xs font-normal text-muted-foreground">
              Current password
            </Label>
            <Input
              id="pwdCurrent"
              type="password"
              value={pwd.current}
              onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
              autoComplete="current-password"
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pwdNext" className="text-xs font-normal text-muted-foreground">
                New password
              </Label>
              <Input
                id="pwdNext"
                type="password"
                value={pwd.next}
                onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
                autoComplete="new-password"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwdConfirm" className="text-xs font-normal text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                id="pwdConfirm"
                type="password"
                value={pwd.confirm}
                onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password"
                className="h-11"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleChangePassword}
              disabled={!pwd.current || !pwd.next || !pwd.confirm || savingPwd}
              className="gap-1.5"
            >
              {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Change password
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
