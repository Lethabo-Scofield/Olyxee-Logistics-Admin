import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Moon, Sun, Check, Palette, Building2, ImageIcon,
  AlertCircle, Upload, X, Sparkles, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Image helpers ────────────────────────────────────────────────────────────
const FAVICON_OUTPUT_SIZE = 64;
const LOGO_MAX_DIMENSION = 512;
const LOGO_JPEG_QUALITY = 0.85;

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

async function compressFavicon(file: File): Promise<string> {
  if (file.type === "image/svg+xml" || file.type === "image/x-icon" || file.type === "image/vnd.microsoft.icon") {
    return readFileAsDataUrl(file);
  }
  const { img, revoke } = await loadImage(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = FAVICON_OUTPUT_SIZE;
    canvas.height = FAVICON_OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, FAVICON_OUTPUT_SIZE, FAVICON_OUTPUT_SIZE);
    return canvas.toDataURL("image/png");
  } finally {
    revoke();
  }
}

async function compressLogo(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    return readFileAsDataUrl(file);
  }
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

// ─── Constants ────────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  { label: "Charcoal", hex: "#2b2b2b" },
  { label: "Graphite", hex: "#3f3f3f" },
  { label: "Slate", hex: "#475569" },
  { label: "Ocean", hex: "#2563eb" },
  { label: "Indigo", hex: "#4f46e5" },
  { label: "Emerald", hex: "#059669" },
  { label: "Rose", hex: "#e11d48" },
  { label: "Violet", hex: "#7c3aed" },
];

const SECTIONS = [
  { id: "branding", label: "Branding", icon: Building2 },
  { id: "color", label: "Brand color", icon: Palette },
  { id: "appearance", label: "Appearance", icon: Sparkles },
];

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeader({
  id, icon: Icon, title, description,
}: { id: string; icon: React.ElementType; title: string; description: string }) {
  return (
    <div id={id} className="flex items-start gap-3 scroll-mt-24">
      <div className="h-9 w-9 flex items-center justify-center bg-muted flex-shrink-0">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ─── Drop zone tile (for logo/favicon) ────────────────────────────────────────
interface DropZoneProps {
  label: string;
  hint: string;
  value: string;
  previewClassName?: string;
  square?: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
  inputAccept?: string;
}

function DropZone({
  label, hint, value, previewClassName, square, onFile, onRemove, inputAccept = "image/*",
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => { setPreviewError(false); }, [value]);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, SVG, or ICO).");
      return;
    }
    onFile(file);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={inputAccept}
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      {value && !previewError ? (
        <div className="flex items-stretch gap-3 border border-border bg-card p-3">
          <div className={cn(
            "flex items-center justify-center bg-muted/50 border border-border flex-shrink-0",
            square ? "h-20 w-20" : "h-20 w-32",
          )}>
            <img
              src={value}
              alt={`${label} preview`}
              className={cn("object-contain", previewClassName ?? "max-h-full max-w-full")}
              onError={() => setPreviewError(true)}
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              {label} in use
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
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
                Drop an image here, or <span className="text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground max-w-[280px]">{hint}</p>
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const theme = useTheme();

  const [form, setForm] = useState({
    businessName: theme.businessName,
    businessTagline: theme.businessTagline,
    logoUrl: theme.logoUrl,
    faviconUrl: theme.faviconUrl,
    primaryColor: theme.primaryColor,
  });

  const isValidHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

  const handleSave = () => {
    if (!isValidHex(form.primaryColor)) {
      toast.error("Brand color must be a valid hex (e.g. #2563eb).");
      return;
    }
    theme.saveSettings({
      businessName: form.businessName,
      businessTagline: form.businessTagline,
      logoUrl: form.logoUrl,
      faviconUrl: form.faviconUrl,
      primaryColor: form.primaryColor,
    });
    toast.success("Settings saved");
  };

  const handleDiscard = () => {
    setForm({
      businessName: theme.businessName,
      businessTagline: theme.businessTagline,
      logoUrl: theme.logoUrl,
      faviconUrl: theme.faviconUrl,
      primaryColor: theme.primaryColor,
    });
  };

  async function handleImagePicked(file: File, kind: "logo" | "favicon") {
    // Only update form state — changes apply to the live theme on Save.
    // This avoids silently persisting uploads when the user navigates away
    // without saving.
    try {
      const dataUrl = kind === "logo"
        ? await compressLogo(file)
        : await compressFavicon(file);
      setForm((f) => ({ ...f, [kind === "logo" ? "logoUrl" : "faviconUrl"]: dataUrl }));
    } catch {
      toast.error("Could not read that image. Try a different file.");
    }
  }

  const hasChanges =
    form.businessName !== theme.businessName ||
    form.businessTagline !== theme.businessTagline ||
    form.logoUrl !== theme.logoUrl ||
    form.faviconUrl !== theme.faviconUrl ||
    form.primaryColor !== theme.primaryColor;

  return (
    <div className="min-h-full pb-32">
      <div className="mx-auto w-full max-w-3xl">
        {/* Page header */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">
            Customise this workspace — branding, color, and appearance.
          </p>
        </header>

        {/* Section quick-nav */}
        <nav className="mb-10 flex flex-wrap gap-1.5 border-b border-border pb-3">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </a>
          ))}
        </nav>

        <div className="space-y-14">
          {/* ─── Branding ─────────────────────────────────────────────── */}
          <section className="space-y-6">
            <SectionHeader
              id="branding"
              icon={Building2}
              title="Business branding"
              description="Shown in the sidebar and on customer-facing communications."
            />

            <div className="space-y-5 pl-12">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business name</Label>
                  <Input
                    id="businessName"
                    value={form.businessName}
                    onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="Your business name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessTagline">Tagline</Label>
                  <Input
                    id="businessTagline"
                    value={form.businessTagline}
                    onChange={e => setForm(f => ({ ...f, businessTagline: e.target.value }))}
                    placeholder="Enterprise Logistics"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm">Logo</Label>
                  </div>
                  <DropZone
                    label="Logo"
                    hint="PNG, SVG, or JPEG. A horizontal logo (around 200×60) works best."
                    value={form.logoUrl}
                    onFile={(file) => handleImagePicked(file, "logo")}
                    onRemove={() => setForm(f => ({ ...f, logoUrl: "" }))}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm">Favicon</Label>
                  </div>
                  <DropZone
                    label="Favicon"
                    hint="Square PNG, ICO, or SVG. 32×32 or 64×64 looks crisp in the browser tab."
                    value={form.faviconUrl}
                    square
                    onFile={(file) => handleImagePicked(file, "favicon")}
                    onRemove={() => setForm(f => ({ ...f, faviconUrl: "" }))}
                    inputAccept="image/*,.ico"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ─── Brand color ──────────────────────────────────────────── */}
          <section className="space-y-6">
            <SectionHeader
              id="color"
              icon={Palette}
              title="Brand color"
              description="Used for buttons, active states, and highlights across the admin panel."
            />

            <div className="space-y-6 pl-12">
              {/* Preset swatches */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Presets</Label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_COLORS.map(c => {
                    const active = form.primaryColor.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.label}
                        onClick={() => setForm(f => ({ ...f, primaryColor: c.hex }))}
                        className={cn(
                          "group relative aspect-square w-full flex items-center justify-center transition-transform",
                          "ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active && "ring-2 ring-foreground scale-[0.97]",
                        )}
                        style={{ backgroundColor: c.hex }}
                        aria-pressed={active}
                      >
                        {active && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
                        <span className="sr-only">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Custom hex */}
              <div className="space-y-3">
                <Label className="text-sm">Custom color</Label>
                <div className="flex gap-2 items-center">
                  <div
                    className="relative h-10 w-10 border border-border overflow-hidden flex-shrink-0"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="Pick a color"
                    />
                  </div>
                  <Input
                    value={form.primaryColor}
                    onChange={e => {
                      const v = e.target.value;
                      if (/^#[0-9a-f]{0,6}$/i.test(v)) setForm(f => ({ ...f, primaryColor: v }));
                    }}
                    className="font-mono w-32 h-10 uppercase"
                    placeholder="#2563eb"
                  />
                  <div className="flex-1 text-xs text-muted-foreground">
                    Or click the swatch to pick from the colour wheel.
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="border border-border bg-muted/30 p-5 space-y-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Live preview</p>
                <div className="flex gap-2 flex-wrap items-center">
                  <button
                    type="button"
                    className="px-4 h-9 text-sm font-medium text-white"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    Primary action
                  </button>
                  <button
                    type="button"
                    className="px-4 h-9 text-sm font-medium border bg-background"
                    style={{ color: form.primaryColor, borderColor: form.primaryColor }}
                  >
                    Outline
                  </button>
                  <span
                    className="px-2 py-1 text-[11px] font-semibold text-white tracking-wide uppercase"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    Badge
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-sm font-medium ml-1"
                    style={{ color: form.primaryColor }}
                  >
                    Link text →
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Appearance ──────────────────────────────────────────── */}
          <section className="space-y-6">
            <SectionHeader
              id="appearance"
              icon={Sparkles}
              title="Appearance"
              description="Choose between light and dark mode for this workspace."
            />

            <div className="pl-12">
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
              <p className="text-xs text-muted-foreground mt-3">
                Your preference is saved per browser.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* ─── Sticky save bar ───────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 md:left-56 z-30 border-t bg-background/95 backdrop-blur transition-transform duration-200",
          hasChanges ? "translate-y-0 border-border shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.1)]" : "translate-y-full border-transparent",
        )}
        role="region"
        aria-label="Unsaved changes"
      >
        <div className="mx-auto max-w-3xl px-6 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 bg-amber-500 inline-block animate-pulse" />
            <span className="text-foreground font-medium">Unsaved changes</span>
            <span className="text-muted-foreground hidden sm:inline">— review and save to apply.</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Check className="h-4 w-4" />
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
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
      {/* Faux window preview */}
      <div className={cn("h-20 w-full border border-border/60 overflow-hidden flex", bg)}>
        <div className={cn("w-1/3 border-r border-border/40 p-2 flex flex-col gap-1.5", bg === "bg-white" ? "bg-zinc-50" : "bg-zinc-950")}>
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
