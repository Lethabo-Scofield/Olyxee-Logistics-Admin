import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Moon, Sun, Check, AlertCircle, Upload, X, Eye, Loader2, Pipette, Shuffle,
  Building2, Palette, Mail, SunMoon, RotateCcw, Sparkles, History,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGetBusiness, useUpdateBusiness } from "@workspace/api-client-react";
import { ActivityFeed } from "@/components/activity-feed";

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

const DEFAULT_PRIMARY = "#2b2b2b";

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
  businessName?: string;
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
        <div className="flex items-stretch gap-3 border border-border bg-background p-3">
          <div
            className={cn(
              "flex items-center justify-center bg-muted/40 border border-border flex-shrink-0",
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
            {businessName ? (
              isFavicon ? (
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
    const s = 55 + Math.floor(Math.random() * 25);
    const l = 38 + Math.floor(Math.random() * 18);
    onChange(hslToHex(h, s, l));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Tap a preset, use the spectrum, or type a hex.
        </p>
        <button
          type="button"
          onClick={surpriseMe}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <Shuffle className="h-3 w-3" /> Surprise me
        </button>
      </div>

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
                "relative aspect-square w-full flex items-center justify-center transition-transform duration-200 ease-out",
                "ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "ring-2 ring-foreground scale-[0.94]",
              )}
              style={{ backgroundColor: c.hex }}
              aria-pressed={active}
            >
              {active && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
              <span className="sr-only">{c.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          title="Pick a custom color"
          onClick={() => nativeRef.current?.click()}
          className={cn(
            "relative aspect-square w-full flex items-center justify-center transition-transform duration-200 ease-out",
            "ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "[background:conic-gradient(from_0deg,#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899,#ef4444)]",
            !presetMatch && "ring-2 ring-foreground scale-[0.94]",
          )}
          aria-label="Pick a custom color"
        >
          {!presetMatch ? (
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

      <input
        ref={nativeRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="flex items-center gap-2 pt-1">
        <div
          className="h-9 w-9 border border-border flex-shrink-0"
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

      {hexError && (
        <p className="text-xs text-destructive">
          Enter a valid hex like <code>2563eb</code> or <code>#abc</code>.
        </p>
      )}
    </div>
  );
}

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

// ─── Section primitives (Apple "Inset Grouped" feel) ──────────────────────────
// A section is a titled card. Title + description live OUTSIDE the card (small,
// muted) — content lives INSIDE on a flat surface with hairline dividers
// between rows. This is the macOS / iOS Settings pattern and keeps the page
// scannable when you have a lot of fields.

function SectionShell({
  id, icon: Icon, title, description, action, children,
}: {
  // Optional — used to be required for scrollspy anchors. With tabs now
  // driving navigation, callers usually omit it.
  id?: string;
  icon: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      // scroll-mt accounts for the sticky page header so anchor jumps land
      // with breathing room above the section title.
      className="scroll-mt-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
    >
      <header className="px-1 mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-foreground">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>

      <div className="bg-card border border-border divide-y divide-border/70">
        {children}
      </div>
    </section>
  );
}

function SectionRow({
  label, hint, htmlFor, children, align = "stack",
}: {
  label?: string;
  hint?: string;
  // When provided, threads an explicit label↔control association so screen
  // readers announce the field name correctly. Falls back to a plain <Label>
  // when the row's "control" isn't a single input (e.g. logo upload tile).
  htmlFor?: string;
  children: React.ReactNode;
  // "stack" = label above, content below (good for inputs and tiles).
  // "split" = label left, content right (good for compact toggles).
  align?: "stack" | "split";
}) {
  if (align === "split") {
    return (
      <div className="px-4 py-3.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          {label && <p className="text-sm font-medium text-foreground">{label}</p>}
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="px-4 py-4 space-y-2">
      {label && (
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </Label>
      )}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Small "Restore" button surfaced in section headers when that section is
// dirty. Lets the user revert one section without touching the rest.
function RestoreButton({ onClick, label = "Restore" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
      title="Revert this section to saved values"
    >
      <RotateCcw className="h-3 w-3" />
      {label}
    </button>
  );
}

// ─── Inline mini-previews ─────────────────────────────────────────────────────
// Small "see it before you save it" cards that sit directly under each brand
// control. They use the form's *current* (un-saved) values so the user can
// experiment freely and revert without ever committing.

function PreviewFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border border-border bg-muted/20">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/40 font-medium">
        {label}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// "How it looks on the customer email / tracking header"
function IdentityPreview({ businessName, tagline }: { businessName: string; tagline: string }) {
  const name = businessName.trim() || "Your business";
  return (
    <PreviewFrame label="On customer emails">
      <div className="space-y-0.5">
        <p className="text-base font-semibold text-foreground leading-tight">{name}</p>
        {tagline.trim() ? (
          <p className="text-xs text-muted-foreground">{tagline}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">
            Add a tagline to give customers a one-line sense of who you are.
          </p>
        )}
      </div>
    </PreviewFrame>
  );
}

// "How it looks in the sidebar of this app"
function SidebarLogoPreview({
  logoUrl, businessName, primaryColor,
}: { logoUrl: string; businessName: string; primaryColor: string }) {
  const name = businessName.trim() || "Your business";
  return (
    <PreviewFrame label="In the sidebar">
      <div className="flex items-center gap-2.5 px-3 h-12 border border-border bg-background">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            aria-hidden="true"
            className="h-6 w-auto object-contain max-w-[72px] flex-shrink-0"
          />
        ) : (
          <div
            className="h-6 w-6 flex items-center justify-center flex-shrink-0"
            style={{ background: primaryColor }}
          >
            <span className="text-white text-[10px] font-bold leading-none">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="font-semibold text-sm tracking-tight truncate">{name}</span>
      </div>
    </PreviewFrame>
  );
}

// Browser-tab chrome mockup so the favicon's real context is visible.
function BrowserTabPreview({ faviconUrl, businessName }: { faviconUrl: string; businessName: string }) {
  const name = businessName.trim() || "Your business";
  return (
    <PreviewFrame label="In a browser tab">
      {/* Browser chrome — a stack of tabs with the active one highlighted so
          the favicon reads in its real visual context. */}
      <div className="bg-muted/60 pt-2 px-2 border-b border-border">
        <div className="flex items-end gap-1">
          {/* Inactive tab — provides a contrast reference. */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 border-t border-l border-r border-border text-[11px] text-muted-foreground">
            <div className="h-3 w-3 bg-muted-foreground/30" aria-hidden="true" />
            <span>Mail</span>
          </div>
          {/* Active tab — the one with our favicon. */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background border-t border-l border-r border-border -mb-px text-[11px] text-foreground max-w-[180px]">
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt=""
                aria-hidden="true"
                className="h-3.5 w-3.5 object-contain flex-shrink-0"
              />
            ) : (
              <div className="h-3.5 w-3.5 bg-muted-foreground/30 flex-shrink-0" aria-hidden="true" />
            )}
            <span className="truncate font-medium">{name}</span>
            <X className="h-2.5 w-2.5 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
          </div>
        </div>
      </div>
      {/* A sliver of "page" so the tab clearly sits on top of something. */}
      <div className="h-6 bg-background border-x border-b border-border" />
      {!faviconUrl && (
        <p className="text-[11px] text-muted-foreground/70 mt-3">
          No favicon yet — your tab will show a generic icon.
        </p>
      )}
    </PreviewFrame>
  );
}

// Shows the color on the same surfaces it'll actually drive (button + status
// chip) so the user can sanity-check contrast at a glance.
function BrandColorPreview({ color }: { color: string }) {
  return (
    <PreviewFrame label="Where this color shows up">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium text-white"
          style={{ background: color }}
        >
          Primary button
        </span>
        <span
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium border"
          style={{ borderColor: color, color }}
        >
          <span className="h-1.5 w-1.5" style={{ background: color }} aria-hidden="true" />
          Active status
        </span>
        <span
          className="text-sm font-medium underline underline-offset-2"
          style={{ color }}
        >
          A link
        </span>
      </div>
    </PreviewFrame>
  );
}

// ─── Live brand preview ───────────────────────────────────────────────────────
// Senior-dev touch: show the admin EXACTLY where their choices land. The
// preview renders a mini sidebar (logo + business name on the brand color) and
// a mini browser tab (favicon + name) using the current form values — so the
// user sees the result before they hit Save.
function LivePreview({
  businessName, businessTagline, logoUrl, faviconUrl, primaryColor,
}: {
  businessName: string;
  businessTagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
}) {
  const name = businessName.trim() || "Your business";
  return (
    <SectionShell
      id="preview"
      icon={Sparkles}
      title="Live preview"
      description="A peek at how your brand will appear to your team and customers."
    >
      <div className="px-4 py-5 space-y-5">
        {/* Sidebar header mockup */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            Sidebar
          </p>
          <div className="border border-border bg-background p-3 flex items-center gap-2.5">
            <div
              className="h-8 w-8 flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" title={name}>{name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {businessTagline.trim() || "Logistics workspace"}
              </p>
            </div>
          </div>
        </div>

        {/* Browser tab mockup */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            Browser tab
          </p>
          <div className="flex">
            <div className="inline-flex items-center gap-1.5 max-w-full border border-border border-b-transparent bg-muted/40 pl-2 pr-3 py-1.5">
              {faviconUrl ? (
                <img src={faviconUrl} alt="" className="h-3.5 w-3.5 object-contain flex-shrink-0" />
              ) : (
                <div className="h-3.5 w-3.5 bg-muted-foreground/30 flex-shrink-0" />
              )}
              <span className="text-xs font-medium truncate">{name}</span>
              <X className="h-3 w-3 text-muted-foreground/60 ml-1 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Email status pill mockup */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            Email accent
          </p>
          <div className="border border-border bg-background p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="text-sm font-medium">
              Your package is on the move — <span className="text-muted-foreground">OLY-7K3-9PQ4</span>
            </p>
            <div
              className="inline-block text-[11px] font-medium text-white px-2 py-1"
              style={{ backgroundColor: primaryColor }}
            >
              In transit
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
// Each entry drives one TabsTrigger and matches the `id` of one TabsContent
// below. Order here is the order shown to the user.
const NAV_ITEMS = [
  { id: "identity", label: "Identity", icon: Building2 },
  { id: "brand", label: "Brand", icon: Palette },
  { id: "preview", label: "Preview", icon: Sparkles },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "appearance", label: "Appearance", icon: SunMoon },
  { id: "activity", label: "Activity", icon: History },
] as const;

// ─── Settings page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const theme = useTheme();

  // Local form state for the theme/branding bits. Email wording lives in its
  // own component because it persists to the server, not localStorage.
  const initial = useMemo(
    () => ({
      businessName: theme.businessName,
      businessTagline: theme.businessTagline,
      logoUrl: theme.logoUrl,
      faviconUrl: theme.faviconUrl,
      primaryColor: theme.primaryColor,
    }),
    // Re-baseline only when the saved theme values change (e.g. after a save).
    [theme.businessName, theme.businessTagline, theme.logoUrl, theme.faviconUrl, theme.primaryColor],
  );

  const [form, setForm] = useState(initial);

  // Re-baseline form when saved theme changes from elsewhere (e.g. theme
  // toggle in the sidebar). Keeps the page in sync without clobbering unsaved
  // typing because we only reset when the saved snapshot itself shifts.
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  // Which sections are dirty? Drives the side-nav dot indicators and lets us
  // show a precise "N changes" count in the save bar.
  const dirty = useMemo(() => {
    const ids = new Set<string>();
    if (
      form.businessName !== initial.businessName ||
      form.businessTagline !== initial.businessTagline
    ) {
      ids.add("identity");
    }
    if (
      form.logoUrl !== initial.logoUrl ||
      form.faviconUrl !== initial.faviconUrl ||
      form.primaryColor !== initial.primaryColor
    ) {
      ids.add("brand");
    }
    return ids;
  }, [form, initial]);

  const hasChanges = dirty.size > 0;
  const changeCount =
    (form.businessName !== initial.businessName ? 1 : 0) +
    (form.businessTagline !== initial.businessTagline ? 1 : 0) +
    (form.logoUrl !== initial.logoUrl ? 1 : 0) +
    (form.faviconUrl !== initial.faviconUrl ? 1 : 0) +
    (form.primaryColor !== initial.primaryColor ? 1 : 0);

  const handleSave = useCallback(() => {
    theme.saveSettings({
      businessName: form.businessName,
      businessTagline: form.businessTagline,
      logoUrl: form.logoUrl,
      faviconUrl: form.faviconUrl,
      primaryColor: form.primaryColor,
    });
    toast.success("Settings saved");
  }, [theme, form]);

  const handleDiscard = useCallback(() => {
    setForm(initial);
  }, [initial]);

  // Track the email editor's dirty state so the beforeunload guard covers
  // unsaved email wording too (email persists server-side via its own button,
  // so it's not in the page-level save bar — but losing typed text on tab
  // close would still be a bad surprise).
  const [emailDirty, setEmailDirty] = useState(false);
  const guardActive = hasChanges || emailDirty;

  // ⌘S / Ctrl+S — power-user shortcut. Browsers reserve this for "Save page",
  // so we preventDefault and route it to our save handler.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isSave = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;
      e.preventDefault();
      if (hasChanges) handleSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasChanges, handleSave]);

  // Soft guard: prompt before navigating away with unsaved theme changes.
  // The modern browsers ignore custom strings, but they still show the
  // confirmation dialog when returnValue is set.
  useEffect(() => {
    if (!guardActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [guardActive]);

  // Active tab. Honour a deep-link hash (#brand, #emails, …) on first mount
  // so links from elsewhere can drop the user straight onto a tab.
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return NAV_ITEMS[0].id;
    const hash = window.location.hash.replace(/^#/, "");
    return NAV_ITEMS.some((n) => n.id === hash) ? hash : NAV_ITEMS[0].id;
  });

  // Keep the URL hash in sync as the tab changes — preserves deep-linking
  // and back/forward navigation between tabs.
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    if (typeof window !== "undefined" && window.history.replaceState) {
      window.history.replaceState(null, "", `#${value}`);
    }
  }, []);

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

  return (
    <div className="min-h-full pb-32">
      {/* Page header — kept generous; this is the moment the page "establishes
          itself" before the content groups begin. */}
      <header className="mb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1.5 text-[15px]">
          Tune how Olyxee looks for your team and your customers.
        </p>
      </header>

      {/* Tabs — replace the long scroll. Only the active panel renders, so
          there's no off-screen content competing for attention. */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="max-w-4xl">
        {/* TabsList scrolls horizontally on narrow viewports so the labels
            never wrap or truncate. */}
        <TabsList className="h-auto p-1 bg-muted/60 w-full sm:w-auto flex flex-wrap justify-start gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isDirty = dirty.has(item.id);
            return (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="gap-2 px-3 py-1.5 data-[state=active]:shadow-sm"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {isDirty && (
                  <span
                    className="h-1.5 w-1.5 bg-amber-500 inline-block"
                    aria-label="Unsaved changes"
                  />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          Tip: press <kbd className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-medium bg-muted border border-border">⌘S</kbd> to save.
        </p>

        {/* ─── Identity ─────────────────────────────────────────────── */}
        <TabsContent value="identity" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={Building2}
            title="Identity"
            description="The name your team and customers see across Olyxee."
            action={
              dirty.has("identity") && (
                <RestoreButton
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      businessName: initial.businessName,
                      businessTagline: initial.businessTagline,
                    }))
                  }
                />
              )
            }
          >
            <SectionRow
              label="Business name"
              hint="Shown in the sidebar and on every customer email."
              htmlFor="businessName"
            >
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                placeholder="Your business name"
                className="h-11"
                autoComplete="organization"
              />
            </SectionRow>

            <SectionRow
              label="Tagline"
              hint="A short phrase shown under your name on customer emails and the tracking page. Optional."
              htmlFor="businessTagline"
            >
              <Input
                id="businessTagline"
                value={form.businessTagline}
                onChange={(e) =>
                  setForm((f) => ({ ...f, businessTagline: e.target.value.slice(0, 80) }))
                }
                placeholder="e.g. Fast, reliable shipping across the EU"
                className="h-11"
                maxLength={80}
              />
              <IdentityPreview
                businessName={form.businessName}
                tagline={form.businessTagline}
              />
            </SectionRow>
          </SectionShell>
        </TabsContent>

        {/* ─── Brand ────────────────────────────────────────────────── */}
        <TabsContent value="brand" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={Palette}
            title="Brand"
            description="Logo, favicon, and the accent color that ties everything together."
            action={
              dirty.has("brand") && (
                <RestoreButton
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      logoUrl: initial.logoUrl,
                      faviconUrl: initial.faviconUrl,
                      primaryColor: initial.primaryColor,
                    }))
                  }
                />
              )
            }
          >
            <SectionRow label="Logo" hint="Drop in a PNG, SVG, or JPEG. We'll downscale large images automatically.">
              <LogoUpload
                variant="logo"
                businessName={form.businessName}
                value={form.logoUrl}
                onFile={handleLogoPicked}
                onRemove={() => setForm((f) => ({ ...f, logoUrl: "" }))}
              />
              <SidebarLogoPreview
                logoUrl={form.logoUrl}
                businessName={form.businessName}
                primaryColor={form.primaryColor}
              />
            </SectionRow>

            <SectionRow label="Favicon" hint="Shown in browser tabs. Square images work best.">
              <LogoUpload
                variant="favicon"
                businessName={form.businessName}
                value={form.faviconUrl}
                onFile={handleFaviconPicked}
                onRemove={() => setForm((f) => ({ ...f, faviconUrl: "" }))}
              />
              <BrowserTabPreview
                faviconUrl={form.faviconUrl}
                businessName={form.businessName}
              />
            </SectionRow>

            <SectionRow label="Brand color">
              <BrandColorPicker
                value={form.primaryColor}
                onChange={(hex) => setForm((f) => ({ ...f, primaryColor: hex }))}
              />
              <BrandColorPreview color={form.primaryColor} />
            </SectionRow>
          </SectionShell>

          {/* Quiet reset-color escape hatch lives with the brand tab. */}
          <footer className="px-1 pt-4 text-xs text-muted-foreground flex items-center justify-between">
            <span>Branding is stored on this device.</span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, primaryColor: DEFAULT_PRIMARY }))}
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset brand color
            </button>
          </footer>
        </TabsContent>

        {/* ─── Live preview ─────────────────────────────────────────── */}
        <TabsContent value="preview" className="mt-6 focus-visible:outline-none">
          <LivePreview
            businessName={form.businessName}
            businessTagline={form.businessTagline}
            logoUrl={form.logoUrl}
            faviconUrl={form.faviconUrl}
            primaryColor={form.primaryColor}
          />
        </TabsContent>

        {/* ─── Customer emails ──────────────────────────────────────── */}
        <TabsContent value="emails" className="mt-6 focus-visible:outline-none">
          <EmailCustomizationSection
            businessName={form.businessName || "Olyxee"}
            onDirtyChange={setEmailDirty}
          />
        </TabsContent>

        {/* ─── Appearance ───────────────────────────────────────────── */}
        <TabsContent value="appearance" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={SunMoon}
            title="Appearance"
            description="Pick the look that's easier on your eyes."
          >
            <div className="p-4">
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
            </div>
          </SectionShell>
        </TabsContent>

        {/* ─── Activity ─────────────────────────────────────────────── */}
        <TabsContent value="activity" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={History}
            title="Activity"
            description="A plain-English log of what's happened in your account."
          >
            <ActivityFeed />
          </SectionShell>
        </TabsContent>
      </Tabs>

      {/* ─── Sticky save bar ───────────────────────────────────────────────
          Floats above the content with a soft backdrop blur. Slides in only
          when there are real changes — the empty state would feel like noise. */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 md:left-56 z-30 border-t bg-background/85 backdrop-blur-md transition-all duration-300 ease-out",
          hasChanges
            ? "translate-y-0 opacity-100 border-border shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)]"
            : "translate-y-full opacity-0 border-transparent pointer-events-none",
        )}
        role="region"
        aria-label="Unsaved changes"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm min-w-0">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-foreground font-medium truncate">
              {changeCount === 1 ? "1 unsaved change" : `${changeCount} unsaved changes`}
            </span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Check className="h-4 w-4" />
              Save changes
              <kbd className="hidden sm:inline-flex ml-1 items-center justify-center min-w-[1.25rem] h-4 px-1 text-[10px] font-medium bg-primary-foreground/15 border border-primary-foreground/20 text-primary-foreground/90">
                ⌘S
              </kbd>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Customer email wording ───────────────────────────────────────────────────
// Lives server-side on the Business record so the API server can inject it
// into outgoing customer status emails. Self-contained — has its own load /
// save lifecycle and "Save email wording" button so it doesn't interfere with
// the page-level "Unsaved changes" bar (which is wired to the theme form).
function EmailCustomizationSection({
  businessName,
  onDirtyChange,
}: {
  businessName: string;
  // Lets the parent extend its beforeunload guard to cover unsaved email
  // wording. We notify on every transition rather than every keystroke.
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { data: business, isLoading, refetch } = useGetBusiness();
  const updateMutation = useUpdateBusiness();

  const [form, setForm] = useState({
    emailGreeting: "",
    emailSignature: "",
    emailFooterNote: "",
  });
  const [loaded, setLoaded] = useState(false);

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

  // Surface dirty state to the parent so the page-level beforeunload guard
  // can fire when email wording has unsaved changes too.
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

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

  const handleReset = () => {
    setForm({
      emailGreeting: business?.emailGreeting ?? "",
      emailSignature: business?.emailSignature ?? "",
      emailFooterNote: business?.emailFooterNote ?? "",
    });
  };

  // Token substitution for the live preview. Mirrors the server-side template
  // behaviour so the admin sees exactly what the customer would receive.
  const sub = (s: string) =>
    s
      .replace(/\{name\}/g, "Sam")
      .replace(/\{businessName\}/g, businessName);

  // Defaults intentionally mirror the server-side template helpers in
  // artifacts/api-server/src/lib/email.ts (renderGreeting / renderSignature /
  // renderFooterNote). Keeping them in sync is the only way the live preview
  // tells the truth about what customers will actually receive.
  const previewGreeting = sub(form.emailGreeting || "Hi {name},");
  const previewSignature = sub(form.emailSignature || "— {businessName}");
  const previewFooter = sub(form.emailFooterNote || "");

  return (
    <SectionShell
      id="emails"
      icon={Mail}
      title="Customer emails"
      description="Customize the greeting, sign-off, and footer on status emails."
      action={dirty ? <RestoreButton onClick={handleReset} /> : undefined}
    >
      {/* Token legend */}
      <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Tokens:</span>
        <code className="font-mono text-foreground bg-background border border-border px-1.5 py-0.5">{"{name}"}</code>
        <span className="text-muted-foreground/70">customer's name</span>
        <code className="font-mono text-foreground bg-background border border-border px-1.5 py-0.5">{"{businessName}"}</code>
        <span className="text-muted-foreground/70">your business</span>
      </div>

      {isLoading && !loaded ? (
        <div className="px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <SectionRow
            label="Greeting"
            hint="The first line of every status email."
            htmlFor="emailGreeting"
          >
            <Input
              id="emailGreeting"
              value={form.emailGreeting}
              onChange={(e) => setForm((f) => ({ ...f, emailGreeting: e.target.value }))}
              placeholder="Hi {name},"
              className="h-11"
              maxLength={200}
            />
          </SectionRow>

          <SectionRow
            label="Sign-off"
            hint="Line breaks are preserved."
            htmlFor="emailSignature"
          >
            <Textarea
              id="emailSignature"
              value={form.emailSignature}
              onChange={(e) => setForm((f) => ({ ...f, emailSignature: e.target.value }))}
              placeholder={"Best,\nThe {businessName} team"}
              rows={3}
              maxLength={500}
            />
          </SectionRow>

          <SectionRow
            label="Footer note"
            hint="Optional — shown below the sign-off in muted text."
            htmlFor="emailFooterNote"
          >
            <Textarea
              id="emailFooterNote"
              value={form.emailFooterNote}
              onChange={(e) => setForm((f) => ({ ...f, emailFooterNote: e.target.value }))}
              placeholder="Thanks for shopping with us!"
              rows={2}
              maxLength={500}
            />
          </SectionRow>

          {/* Live email preview — uses real fallbacks + token substitution so
              the admin sees exactly what the customer will get. */}
          <div className="px-4 py-4 bg-muted/20 space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div className="border border-border bg-background p-4 text-sm space-y-3">
              <p className="font-medium">{previewGreeting}</p>
              <p className="text-muted-foreground">
                Your package has left our facility and is making its way to you.
              </p>
              <p className="whitespace-pre-line text-muted-foreground">{previewSignature}</p>
              {previewFooter && (
                <p className="text-xs text-muted-foreground/80 pt-2 border-t border-border/60 whitespace-pre-line">
                  {previewFooter}
                </p>
              )}
            </div>
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Saves immediately — separate from the page-level Save.
            </p>
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
        </>
      )}
    </SectionShell>
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
        "group relative flex flex-col items-stretch border-2 p-3 transition-all duration-200 text-left",
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
