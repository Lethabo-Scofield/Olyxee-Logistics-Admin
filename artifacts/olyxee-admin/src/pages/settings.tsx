import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Moon, Sun, Check, AlertCircle, Upload, X, Eye, Loader2, Pipette, Shuffle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGetBusiness, useUpdateBusiness } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";

// ─── Logo + favicon compression ───────────────────────────────────────────────
const LOGO_MAX_DIMENSION = 512;
const LOGO_JPEG_QUALITY = 0.85;
// Favicons are tiny in the browser tab, so we downscale aggressively and keep
// them as PNGs to preserve transparency (icons usually need it).
const FAVICON_MAX_DIMENSION = 64;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load image"));
      el.src = url;
    });
    return { img, revoke: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

async function compressLogo(file: File): Promise<string> {
  if (file.type === "image/svg+xml") return readFileAsDataUrl(file);
  const { img, revoke } = await loadImage(file);
  try {
    const { naturalWidth: w, naturalHeight: h } = img;
    const scale = Math.min(1, LOGO_MAX_DIMENSION / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, outW, outH);
    if (file.type === "image/png") return canvas.toDataURL("image/png");
    return canvas.toDataURL("image/jpeg", LOGO_JPEG_QUALITY);
  } finally {
    revoke();
  }
}

async function compressFavicon(file: File): Promise<string> {
  // SVG favicons are tiny and resolution-independent — pass straight through.
  if (file.type === "image/svg+xml") return readFileAsDataUrl(file);
  const { img, revoke } = await loadImage(file);
  try {
    const { naturalWidth: w, naturalHeight: h } = img;
    const scale = Math.min(1, FAVICON_MAX_DIMENSION / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, outW, outH);
    return canvas.toDataURL("image/png");
  } finally {
    revoke();
  }
}

// ─── Color presets ────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  { label: "Charcoal", hex: "#2b2b2b" },
  { label: "Slate", hex: "#475569" },
  { label: "Ocean", hex: "#2563eb" },
  { label: "Indigo", hex: "#4f46e5" },
  { label: "Emerald", hex: "#059669" },
  { label: "Rose", hex: "#e11d48" },
];

// Normalize free-typed hex into "#rrggbb". Returns null for invalid input so
// we can surface a clear error instead of writing junk into the theme.
function normalizeHex(raw: string): string | null {
  const trimmed = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(trimmed)) {
    // Expand #abc → #aabbcc so the picker + downstream code see a single form.
    return "#" + trimmed.split("").map(c => c + c).join("").toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(trimmed)) {
    return "#" + trimmed.toLowerCase();
  }
  return null;
}

// ─── Logo upload tile ─────────────────────────────────────────────────────────
function LogoUpload({
  value, onFile, onRemove, businessName, variant = "logo",
}: {
  value: string;
  onFile: (file: File) => void;
  onRemove: () => void;
  // Brand name shown beside the preview, mirroring how the logo will appear
  // in the sidebar / browser tab (image + business name).
  businessName?: string;
  // "logo" → wide preview tile. "favicon" → small square + tab mockup so
  // the user sees roughly how browsers will render it.
  variant?: "logo" | "favicon";
}) {
  const isFavicon = variant === "favicon";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => { setPreviewError(false); }, [value]);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, or SVG).");
      return;
    }
    onFile(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      {value && !previewError ? (
        <div className="flex items-stretch gap-3 border border-border bg-card p-3">
          {/* Preview thumbnail — square for favicon (roughly how a tab shows
              it), wide for logo (roughly how the sidebar shows it). */}
          <div
            className={cn(
              "flex items-center justify-center bg-muted/50 border border-border flex-shrink-0",
              isFavicon ? "h-12 w-12" : "h-20 w-32",
            )}
          >
            <img
              src={value}
              alt={isFavicon ? "Favicon preview" : "Logo preview"}
              className="object-contain max-h-full max-w-full"
              onError={() => setPreviewError(true)}
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
            {/* Live "image + business name" mockup so the user sees what
                customers + browser tabs will actually render. Falls back to
                a helpful hint when the business name hasn't been set yet. */}
            {businessName ? (
              isFavicon ? (
                // Mini browser-tab mockup
                <div className="inline-flex items-center gap-1.5 self-start max-w-full border border-border bg-background/60 pl-1.5 pr-2.5 py-1">
                  <img src={value} alt="" aria-hidden="true" className="h-3.5 w-3.5 object-contain flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{businessName}</span>
                </div>
              ) : (
                <span className="text-sm font-semibold truncate" title={businessName}>
                  {businessName}
                </span>
              )
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Add a business name above to see it next to the {isFavicon ? "favicon" : "logo"}.
              </span>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Eye className="h-3 w-3" />
              {isFavicon ? "Favicon in use" : "Logo in use"}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed transition-colors text-center",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/40",
            previewError && "border-destructive/40",
          )}
        >
          {previewError ? (
            <>
              <AlertCircle className="h-6 w-6 text-destructive/70" aria-hidden="true" />
              <p className="text-sm font-medium text-destructive">Could not load image</p>
              <p className="text-xs text-muted-foreground">Click to upload a new one</p>
            </>
          ) : (
            <>
              <div className="h-9 w-9 flex items-center justify-center bg-background border border-border">
                <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">
                Drop {isFavicon ? "a favicon" : businessName ? `${businessName}'s logo` : "your logo"} here, or <span className="text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground">PNG, SVG, or JPEG</p>
            </>
          )}
        </button>
      )}
    </>
  );
}

// ─── Brand color picker ──────────────────────────────────────────────────────
// Six curated presets cover most brands, but anything outside that palette
// used to be impossible to pick. Now the user can:
//   1. Tap a preset (fastest)
//   2. Tap "Custom" to open the OS-native spectrum picker (full gamut)
//   3. Type a hex code directly (designers will paste from Figma)
//   4. Hit "Surprise me" for a tasteful random color when they're stuck
// All three paths converge on the same `onChange(hex)` so the live preview
// and Save button just work.
function BrandColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [hexDraft, setHexDraft] = useState(value);
  const [hexError, setHexError] = useState(false);

  // Keep the text field in sync when the user picks via preset / spectrum.
  useEffect(() => {
    setHexDraft(value);
    setHexError(false);
  }, [value]);

  const presetMatch = PRESET_COLORS.some(
    (c) => c.hex.toLowerCase() === value.toLowerCase(),
  );

  const commitHex = (raw: string) => {
    const norm = normalizeHex(raw);
    if (!norm) {
      setHexError(true);
      return;
    }
    setHexError(false);
    setHexDraft(norm);
    onChange(norm);
  };

  // Tasteful random — restrict to mid-saturation / mid-lightness so we
  // don't hand the admin neon yellow or near-black.
  const surpriseMe = () => {
    const h = Math.floor(Math.random() * 360);
    const s = 55 + Math.floor(Math.random() * 25); // 55-80
    const l = 38 + Math.floor(Math.random() * 18); // 38-55
    onChange(hslToHex(h, s, l));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <Label className="text-sm font-medium">Brand color</Label>
        <button
          type="button"
          onClick={surpriseMe}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <Shuffle className="h-3 w-3" /> Surprise me
        </button>
      </div>

      {/* Presets + Custom tile.
          The Custom tile is a real button that triggers a hidden native color
          input. Native input gives us the full OS spectrum picker (incl.
          eyedropper on supported browsers) for free — no third-party deps. */}
      <div className="grid grid-cols-7 gap-2">
        {PRESET_COLORS.map((c) => {
          const active = value.toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onClick={() => onChange(c.hex)}
              className={cn(
                "relative aspect-square w-full flex items-center justify-center transition-transform",
                "ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "ring-2 ring-foreground scale-[0.95]",
              )}
              style={{ backgroundColor: c.hex }}
              aria-pressed={active}
            >
              {active && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
              <span className="sr-only">{c.label}</span>
            </button>
          );
        })}

        {/* Custom (spectrum) tile */}
        <button
          type="button"
          title="Pick a custom color"
          onClick={() => nativeRef.current?.click()}
          className={cn(
            "relative aspect-square w-full flex items-center justify-center transition-transform",
            "ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // Rainbow conic gradient so users immediately recognize it as
            // "pick anything you want".
            "[background:conic-gradient(from_0deg,#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899,#ef4444)]",
            !presetMatch && "ring-2 ring-foreground scale-[0.95]",
          )}
          aria-label="Pick a custom color"
        >
          {!presetMatch ? (
            // Show the active custom swatch as a centered dot so the user
            // sees their choice without losing the "spectrum" affordance.
            <span
              className="h-4 w-4 border-2 border-white shadow"
              style={{ backgroundColor: value }}
              aria-hidden="true"
            />
          ) : (
            <Pipette className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Hidden native input — drives the OS spectrum picker. */}
      <input
        ref={nativeRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Hex code field — designers paste from Figma; pairs with a live
          swatch so you see what you're typing before committing. */}
      <div className="flex items-center gap-2 pt-1">
        <div
          className="h-9 w-9 border flex-shrink-0"
          style={{ backgroundColor: hexError ? "transparent" : (normalizeHex(hexDraft) ?? value) }}
        />
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none pointer-events-none">
            #
          </span>
          <Input
            value={hexDraft.replace(/^#/, "")}
            onChange={(e) => {
              const next = e.target.value;
              setHexDraft(next);
              const norm = normalizeHex(next);
              if (norm) {
                setHexError(false);
                onChange(norm);
              } else if (next.trim() === "") {
                setHexError(false);
              } else {
                setHexError(true);
              }
            }}
            onBlur={(e) => commitHex(e.target.value)}
            placeholder="2563eb"
            maxLength={7}
            spellCheck={false}
            className={cn("pl-7 h-9 font-mono uppercase", hexError && "border-destructive focus-visible:ring-destructive")}
            aria-invalid={hexError}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => nativeRef.current?.click()}
        >
          <Pipette className="h-3.5 w-3.5" />
          Spectrum
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {hexError
          ? <span className="text-destructive">Enter a valid hex like <code>2563eb</code> or <code>#abc</code>.</span>
          : "Used for buttons, links, and active states. Tap the rainbow tile or type any hex."}
      </p>
    </section>
  );
}

// HSL → "#rrggbb" — tiny inline helper, avoids pulling in a color library.
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const v = lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ─── Settings page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const theme = useTheme();

  const [form, setForm] = useState({
    businessName: theme.businessName,
    logoUrl: theme.logoUrl,
    faviconUrl: theme.faviconUrl,
    primaryColor: theme.primaryColor,
  });

  const handleSave = () => {
    theme.saveSettings({
      businessName: form.businessName,
      logoUrl: form.logoUrl,
      faviconUrl: form.faviconUrl,
      primaryColor: form.primaryColor,
    });
    toast.success("Settings saved");
  };

  const handleDiscard = () => {
    setForm({
      businessName: theme.businessName,
      logoUrl: theme.logoUrl,
      faviconUrl: theme.faviconUrl,
      primaryColor: theme.primaryColor,
    });
  };

  async function handleLogoPicked(file: File) {
    try {
      const dataUrl = await compressLogo(file);
      setForm((f) => ({ ...f, logoUrl: dataUrl }));
    } catch {
      toast.error("Could not read that image. Try a different file.");
    }
  }

  async function handleFaviconPicked(file: File) {
    try {
      const dataUrl = await compressFavicon(file);
      setForm((f) => ({ ...f, faviconUrl: dataUrl }));
    } catch {
      toast.error("Could not read that image. Try a different file.");
    }
  }

  const hasChanges =
    form.businessName !== theme.businessName ||
    form.logoUrl !== theme.logoUrl ||
    form.faviconUrl !== theme.faviconUrl ||
    form.primaryColor !== theme.primaryColor;

  return (
    <div className="min-h-full pb-32">
      <div className="mx-auto w-full max-w-xl">
        {/* Page header */}
        <header className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">
            Make this workspace feel like yours.
          </p>
        </header>

        <div className="space-y-10">
          {/* ─── Your profile ─────────────────────────────────────── */}
          <ProfileSection />

          {/* ─── Business name ─────────────────────────────────────── */}
          <section className="space-y-2">
            <Label htmlFor="businessName" className="text-sm font-medium">
              Business name
            </Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
              placeholder="Your business name"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Shown in the sidebar and on customer emails.
            </p>
          </section>

          {/* ─── Logo ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <Label className="text-sm font-medium">Logo</Label>
            <LogoUpload
              variant="logo"
              businessName={form.businessName}
              value={form.logoUrl}
              onFile={handleLogoPicked}
              onRemove={() => setForm(f => ({ ...f, logoUrl: "" }))}
            />
          </section>

          {/* ─── Favicon ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <Label className="text-sm font-medium">Favicon</Label>
            <LogoUpload
              variant="favicon"
              businessName={form.businessName}
              value={form.faviconUrl}
              onFile={handleFaviconPicked}
              onRemove={() => setForm(f => ({ ...f, faviconUrl: "" }))}
            />
            <p className="text-xs text-muted-foreground">
              Shown in browser tabs. Square images work best (PNG or SVG).
            </p>
          </section>

          {/* ─── Brand color ──────────────────────────────────────── */}
          <BrandColorPicker
            value={form.primaryColor}
            onChange={(hex) => setForm(f => ({ ...f, primaryColor: hex }))}
          />

          {/* ─── Customer email wording ──────────────────────────── */}
          <EmailCustomizationSection />

          {/* ─── Appearance ──────────────────────────────────────── */}
          <section className="space-y-3">
            <Label className="text-sm font-medium">Appearance</Label>
            <div className="grid grid-cols-2 gap-3">
              <ThemeOption
                active={!theme.isDark}
                onClick={() => theme.setIsDark(false)}
                icon={Sun}
                label="Light"
                bg="bg-white"
                fg="bg-zinc-900"
                muted="bg-zinc-200"
              />
              <ThemeOption
                active={theme.isDark}
                onClick={() => theme.setIsDark(true)}
                icon={Moon}
                label="Dark"
                bg="bg-zinc-900"
                fg="bg-zinc-200"
                muted="bg-zinc-700"
              />
            </div>
          </section>
        </div>
      </div>

      {/* ─── Sticky save bar ───────────────────────────────────────── */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 md:left-56 z-30 border-t bg-background/95 backdrop-blur transition-transform duration-200",
          hasChanges
            ? "translate-y-0 border-border shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.1)]"
            : "translate-y-full border-transparent",
        )}
        role="region"
        aria-label="Unsaved changes"
      >
        <div className="mx-auto max-w-xl px-6 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 bg-amber-500 inline-block animate-pulse" />
            <span className="text-foreground font-medium">Unsaved changes</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Check className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Your profile ─────────────────────────────────────────────────────────────
// Lets the signed-in admin edit their own name + email, and change their
// password. Backed by PUT /auth/me via the auth context (not the typed API
// client — auth is intentionally outside the orval-generated surface).
function ProfileSection() {
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
    <section className="space-y-6">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Your profile</Label>
        <p className="text-xs text-muted-foreground">
          This is the account you're signed in as. Changes apply immediately.
        </p>
      </div>

      <div className="space-y-4">
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
      </div>

      <div className="space-y-4 border-t pt-6">
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
      </div>
    </section>
  );
}

// ─── Customer email wording ───────────────────────────────────────────────────
// Unlike the theme/branding fields above (which live in localStorage), the email
// wording is persisted server-side on the Business record so the API server can
// inject it into outgoing customer status emails. We keep it as a self-contained
// component with its own load/save lifecycle so it doesn't interfere with the
// sticky "Unsaved changes" bar that's wired to the theme form.
function EmailCustomizationSection() {
  const { data: business, isLoading, refetch } = useGetBusiness();
  const updateMutation = useUpdateBusiness();

  const [form, setForm] = useState({
    emailGreeting: "",
    emailSignature: "",
    emailFooterNote: "",
  });
  const [loaded, setLoaded] = useState(false);

  // Hydrate the form once the business data arrives. Empty/null → empty string
  // so the inputs are always controlled; on save, empty strings are sent as
  // null so the server falls back to defaults.
  useEffect(() => {
    if (business && !loaded) {
      setForm({
        emailGreeting: business.emailGreeting ?? "",
        emailSignature: business.emailSignature ?? "",
        emailFooterNote: business.emailFooterNote ?? "",
      });
      setLoaded(true);
    }
  }, [business, loaded]);

  const dirty =
    loaded &&
    (form.emailGreeting !== (business?.emailGreeting ?? "") ||
      form.emailSignature !== (business?.emailSignature ?? "") ||
      form.emailFooterNote !== (business?.emailFooterNote ?? ""));

  const handleSave = () => {
    updateMutation.mutate(
      {
        data: {
          emailGreeting: form.emailGreeting.trim() ? form.emailGreeting : null,
          emailSignature: form.emailSignature.trim() ? form.emailSignature : null,
          emailFooterNote: form.emailFooterNote.trim() ? form.emailFooterNote : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Email wording saved");
          refetch();
        },
        onError: () => toast.error("Could not save email wording"),
      },
    );
  };

  return (
    <section className="space-y-4 border-t pt-8">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Customer email wording</Label>
        <p className="text-xs text-muted-foreground">
          Customize the greeting, sign-off, and footer note on status emails sent
          to customers. Use <code className="font-mono text-foreground">{"{name}"}</code> for the
          customer's name and <code className="font-mono text-foreground">{"{businessName}"}</code> for your business name. Leave blank to use defaults.
        </p>
      </div>

      {isLoading && !loaded ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emailGreeting" className="text-xs font-normal text-muted-foreground">
              Greeting
            </Label>
            <Input
              id="emailGreeting"
              value={form.emailGreeting}
              onChange={(e) => setForm((f) => ({ ...f, emailGreeting: e.target.value }))}
              placeholder="Hi {name},"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emailSignature" className="text-xs font-normal text-muted-foreground">
              Sign-off
            </Label>
            <Textarea
              id="emailSignature"
              value={form.emailSignature}
              onChange={(e) => setForm((f) => ({ ...f, emailSignature: e.target.value }))}
              placeholder={"Best,\nThe {businessName} team"}
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">Line breaks are preserved.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emailFooterNote" className="text-xs font-normal text-muted-foreground">
              Footer note <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Textarea
              id="emailFooterNote"
              value={form.emailFooterNote}
              onChange={(e) => setForm((f) => ({ ...f, emailFooterNote: e.target.value }))}
              placeholder="Thanks for shopping with us!"
              rows={2}
            />
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || updateMutation.isPending}
              className="gap-1.5"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save email wording
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Theme option tile ────────────────────────────────────────────────────────
function ThemeOption({
  active, onClick, icon: Icon, label, bg, fg, muted,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  bg: string;
  fg: string;
  muted: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col items-stretch border-2 p-3 transition-all text-left",
        active
          ? "border-primary bg-primary/[0.03]"
          : "border-border hover:border-muted-foreground/50",
      )}
    >
      <div className={cn("h-20 w-full border border-border/60 overflow-hidden flex", bg)}>
        <div className={cn(
          "w-1/3 border-r border-border/40 p-2 flex flex-col gap-1.5",
          bg === "bg-white" ? "bg-zinc-50" : "bg-zinc-950",
        )}>
          <div className={cn("h-1.5 w-3/4", muted)} />
          <div className={cn("h-1.5 w-1/2", muted)} />
          <div className={cn("h-1.5 w-2/3", muted)} />
        </div>
        <div className="flex-1 p-2 flex flex-col gap-1.5">
          <div className={cn("h-1.5 w-1/3", fg)} />
          <div className={cn("h-1.5 w-2/3", muted)} />
          <div className={cn("h-1.5 w-1/2", muted)} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 px-0.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {active && (
          <span className="inline-flex items-center justify-center h-4 w-4 bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
    </button>
  );
}
