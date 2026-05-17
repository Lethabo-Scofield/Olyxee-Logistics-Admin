import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Moon, Sun, Check, AlertCircle, Upload, X, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Logo compression ─────────────────────────────────────────────────────────
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

// ─── Color presets ────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  { label: "Charcoal", hex: "#2b2b2b" },
  { label: "Slate", hex: "#475569" },
  { label: "Ocean", hex: "#2563eb" },
  { label: "Indigo", hex: "#4f46e5" },
  { label: "Emerald", hex: "#059669" },
  { label: "Rose", hex: "#e11d48" },
];

// ─── Logo upload tile ─────────────────────────────────────────────────────────
function LogoUpload({
  value, onFile, onRemove,
}: { value: string; onFile: (file: File) => void; onRemove: () => void }) {
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
          <div className="flex items-center justify-center bg-muted/50 border border-border flex-shrink-0 h-20 w-32">
            <img
              src={value}
              alt="Logo preview"
              className="object-contain max-h-full max-w-full"
              onError={() => setPreviewError(true)}
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              Logo in use
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
                Drop your logo here, or <span className="text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground">PNG, SVG, or JPEG</p>
            </>
          )}
        </button>
      )}
    </>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const theme = useTheme();

  const [form, setForm] = useState({
    businessName: theme.businessName,
    logoUrl: theme.logoUrl,
    primaryColor: theme.primaryColor,
  });

  const handleSave = () => {
    theme.saveSettings({
      businessName: form.businessName,
      logoUrl: form.logoUrl,
      primaryColor: form.primaryColor,
    });
    toast.success("Settings saved");
  };

  const handleDiscard = () => {
    setForm({
      businessName: theme.businessName,
      logoUrl: theme.logoUrl,
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

  const hasChanges =
    form.businessName !== theme.businessName ||
    form.logoUrl !== theme.logoUrl ||
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
              value={form.logoUrl}
              onFile={handleLogoPicked}
              onRemove={() => setForm(f => ({ ...f, logoUrl: "" }))}
            />
          </section>

          {/* ─── Brand color ──────────────────────────────────────── */}
          <section className="space-y-3">
            <Label className="text-sm font-medium">Brand color</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map(c => {
                const active = form.primaryColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setForm(f => ({ ...f, primaryColor: c.hex }))}
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
            </div>
            <p className="text-xs text-muted-foreground">
              Used for buttons, links, and active states.
            </p>
          </section>

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
