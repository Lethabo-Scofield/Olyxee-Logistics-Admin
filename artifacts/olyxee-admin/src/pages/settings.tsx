import { useRef, useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Check, Palette, Building2, Image, AlertCircle, Upload, X } from "lucide-react";
import { toast } from "sonner";

const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB — kept small because we store as a data URL in localStorage.
const MAX_FAVICON_BYTES = 256 * 1024; // 256 KB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

const PRESET_COLORS = [
  { label: "Charcoal", hex: "#2b2b2b" },
  { label: "Graphite", hex: "#3f3f3f" },
  { label: "Slate", hex: "#475569" },
  { label: "Ocean Blue", hex: "#2563eb" },
  { label: "Indigo", hex: "#4f46e5" },
  { label: "Emerald", hex: "#059669" },
  { label: "Rose", hex: "#e11d48" },
  { label: "Violet", hex: "#7c3aed" },
];

export default function SettingsPage() {
  const theme = useTheme();

  const [form, setForm] = useState({
    businessName: theme.businessName,
    businessTagline: theme.businessTagline,
    logoUrl: theme.logoUrl,
    faviconUrl: theme.faviconUrl,
    primaryColor: theme.primaryColor,
  });

  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    theme.saveSettings({
      businessName: form.businessName,
      businessTagline: form.businessTagline,
      logoUrl: form.logoUrl,
      faviconUrl: form.faviconUrl,
      primaryColor: form.primaryColor,
    });
    toast.success("Settings saved");
  };

  async function handleImagePicked(
    file: File | undefined,
    kind: "logo" | "favicon",
  ) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, SVG, or ICO).");
      return;
    }
    const max = kind === "logo" ? MAX_LOGO_BYTES : MAX_FAVICON_BYTES;
    if (file.size > max) {
      const limit = kind === "logo" ? "1 MB" : "256 KB";
      toast.error(`Image is too large — keep it under ${limit}.`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (kind === "logo") {
        setForm((f) => ({ ...f, logoUrl: dataUrl }));
        setLogoPreviewError(false);
      } else {
        setForm((f) => ({ ...f, faviconUrl: dataUrl }));
        // Apply favicon immediately so the user sees the browser tab update,
        // even before they click Save.
        theme.setFaviconUrl(dataUrl);
      }
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
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Customise this workspace to match your business.</p>
      </div>

      {/* Branding */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Business Branding</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Shown in the sidebar and on customer-facing communications.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
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

          {/* Logo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <Label>Logo</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a PNG, SVG, or JPEG (max 1 MB). Recommended size: 200×60px or wider horizontal logo. You can also paste a URL.
            </p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleImagePicked(e.target.files?.[0], "logo");
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                data-testid="button-upload-logo"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload image
              </Button>
              {form.logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setForm(f => ({ ...f, logoUrl: "" })); setLogoPreviewError(false); }}
                  data-testid="button-remove-logo"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              ) : null}
            </div>
            <Input
              value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
              onChange={e => { setForm(f => ({ ...f, logoUrl: e.target.value })); setLogoPreviewError(false); }}
              placeholder={form.logoUrl.startsWith("data:") ? "Uploaded image in use" : "Or paste a URL: https://yourcompany.com/logo.png"}
              disabled={form.logoUrl.startsWith("data:")}
            />
            {form.logoUrl && (
              <div className="border p-4 bg-sidebar flex items-center gap-3">
                {!logoPreviewError ? (
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="h-8 w-auto max-w-[200px] object-contain"
                    onError={() => setLogoPreviewError(true)}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Could not load image — check the URL
                  </div>
                )}
                <span className="text-xs text-sidebar-foreground/50 ml-auto">Sidebar preview</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Favicon */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <Label>Favicon</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              The small icon shown in the browser tab. Upload a square PNG, ICO, or SVG (max 256 KB). 32×32 or 64×64 works best.
            </p>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/*,.ico"
              className="hidden"
              onChange={(e) => {
                handleImagePicked(e.target.files?.[0], "favicon");
                e.target.value = "";
              }}
            />
            <div className="flex gap-2 items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => faviconInputRef.current?.click()}
                data-testid="button-upload-favicon"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload favicon
              </Button>
              {form.faviconUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setForm(f => ({ ...f, faviconUrl: "" }));
                    theme.setFaviconUrl("");
                  }}
                  data-testid="button-remove-favicon"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              ) : null}
              {form.faviconUrl ? (
                <div className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <img
                    src={form.faviconUrl}
                    alt="Favicon preview"
                    className="h-6 w-6 object-contain border bg-background"
                  />
                  <span>Browser tab preview</span>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Color */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Brand Color</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Used for buttons, active states, and highlights across the admin panel.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Preset swatches */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Presets</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setForm(f => ({ ...f, primaryColor: c.hex }))}
                  className="relative h-8 w-8 border-2 transition-all"
                  style={{
                    backgroundColor: c.hex,
                    borderColor: form.primaryColor === c.hex ? c.hex : "transparent",
                    outline: form.primaryColor === c.hex ? `2px solid ${c.hex}` : "none",
                    outlineOffset: "2px",
                  }}
                >
                  {form.primaryColor === c.hex && (
                    <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom hex */}
          <div className="space-y-2">
            <Label>Custom Color</Label>
            <div className="flex gap-3 items-center">
              <div className="relative">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                  className="h-9 w-9 cursor-pointer border border-border p-0.5"
                  style={{ borderRadius: 0 }}
                />
              </div>
              <Input
                value={form.primaryColor}
                onChange={e => {
                  const v = e.target.value;
                  if (/^#[0-9a-f]{0,6}$/i.test(v)) setForm(f => ({ ...f, primaryColor: v }));
                }}
                className="font-mono w-32"
                placeholder="#2563eb"
              />
              <div
                className="flex-1 h-9 border border-border"
                style={{ backgroundColor: form.primaryColor }}
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="border p-4 space-y-3 bg-muted/30">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
            <div className="flex gap-2 flex-wrap">
              <button
                className="px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: form.primaryColor }}
              >
                Primary Button
              </button>
              <button
                className="px-4 py-2 text-sm font-medium border"
                style={{ color: form.primaryColor, borderColor: form.primaryColor }}
              >
                Outline Button
              </button>
              <span
                className="px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: form.primaryColor }}
              >
                Badge
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            {theme.isDark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
            <CardTitle className="text-base">Appearance</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Choose between light and dark mode for this workspace.</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <button
              onClick={() => theme.setIsDark(false)}
              className={`flex-1 border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                !theme.isDark ? "border-primary" : "border-border hover:border-muted-foreground"
              }`}
            >
              <div className="w-full h-12 bg-white border border-border flex items-center justify-center">
                <div className="w-8 h-2 bg-gray-200" />
              </div>
              <div className="flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5" />
                <span className="text-sm font-medium">Light</span>
              </div>
              {!theme.isDark && <Check className="h-4 w-4 text-primary" />}
            </button>

            <button
              onClick={() => theme.setIsDark(true)}
              className={`flex-1 border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                theme.isDark ? "border-primary" : "border-border hover:border-muted-foreground"
              }`}
            >
              <div className="w-full h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                <div className="w-8 h-2 bg-zinc-700" />
              </div>
              <div className="flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5" />
                <span className="text-sm font-medium">Dark</span>
              </div>
              {theme.isDark && <Check className="h-4 w-4 text-primary" />}
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="border-t pt-6 pb-2">
        <p className="text-xs text-muted-foreground">
          Branding changes apply to this workspace only.
        </p>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          {hasChanges ? "You have unsaved changes." : "All settings are saved."}
        </p>
        <Button onClick={handleSave} disabled={!hasChanges}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
