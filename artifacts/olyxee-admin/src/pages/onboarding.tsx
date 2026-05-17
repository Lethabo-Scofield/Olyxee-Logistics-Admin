import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  useGetBusiness,
  useUpdateBusiness,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/page-loader";
import { LogoUpload } from "@/components/logo-upload";
import { compressLogo } from "@/lib/image-processing";
import { useTheme } from "@/contexts/theme-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import bgImage from "@assets/image_1778124687840.png";

const EMPLOYEE_RANGES = [
  "Just me",
  "2-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
];

const INDUSTRIES = [
  "Freight & logistics",
  "Last-mile delivery",
  "Warehousing",
  "Cold chain",
  "Courier",
  "Other",
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { data: business, isLoading } = useGetBusiness();
  const updateMutation = useUpdateBusiness();
  const theme = useTheme();

  const [form, setForm] = useState({
    name: "",
    tagline: "",
    logoUrl: "",
    industry: "",
    employeeCount: "",
    location: "",
    phone: "",
    websiteUrl: "",
  });

  // Hydrate from existing business once loaded so partially-filled onboarding
  // resumes where the user left off. Branding (logo + tagline) lives client-
  // side in the theme context, so we pull it from there instead of the API.
  useEffect(() => {
    if (!business) return;
    setForm((f) => ({
      name: business.name ?? f.name,
      tagline: theme.businessTagline || f.tagline,
      logoUrl: theme.logoUrl || f.logoUrl,
      industry: business.industry ?? f.industry,
      employeeCount: business.employeeCount ?? f.employeeCount,
      location: business.location ?? f.location,
      phone: business.phone ?? f.phone,
      websiteUrl: business.websiteUrl ?? f.websiteUrl,
    }));
  }, [business, theme.businessTagline, theme.logoUrl]);

  async function handleLogoPicked(file: File) {
    try {
      const dataUrl = await compressLogo(file);
      setForm((f) => ({ ...f, logoUrl: dataUrl }));
    } catch {
      toast.error("Could not read that image. Try a different file.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        data: {
          name: form.name,
          industry: form.industry,
          employeeCount: form.employeeCount,
          location: form.location,
          phone: form.phone,
          websiteUrl: form.websiteUrl,
          onboardingCompleted: true,
        },
      });
      // Branding is stored on-device (localStorage) via the theme context, so
      // push the in-form values out so the sidebar / browser tab / favicon
      // update immediately when the user lands on the dashboard.
      theme.saveSettings({
        businessName: form.name,
        businessTagline: form.tagline,
        logoUrl: form.logoUrl,
      });
      toast.success("Welcome aboard");
      setLocation("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your business details",
      );
    }
  }

  // Mini live preview of how the workspace will look the moment the user
  // hits "Finish setup" — makes the logo upload feel concrete instead of
  // an abstract field. Falls back to the first initial when no logo is set.
  const previewName = form.name.trim() || "Your business";
  const previewInitial = previewName.charAt(0).toUpperCase();

  return (
    <div
      className="relative min-h-[100dvh] bg-[hsl(220,20%,10%)] bg-cover bg-center"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Blurred image layer + dark gradient so the form floats over the photo */}
      <div className="absolute inset-0 backdrop-blur-md bg-black/55" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[720px] items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 px-8 py-10">
          <div className="mb-8">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-[hsl(220,9%,46%)]">
              Step 2 of 2
            </p>
            <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight mt-2">
              Let's set up your workspace
            </h1>
            <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5">
              Add your business name and logo so your dashboard, emails, and
              tracking pages feel like yours from day one. You can change
              anything later in Settings.
            </p>
          </div>

          {isLoading ? (
            <PageLoader label="Loading your account…" />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-7" data-testid="form-onboarding">
              {/* ─── Branding block — leads the form because it's what the user
                  will see first when they enter the app. */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[hsl(220,9%,30%)]">
                    Your brand
                  </h2>
                  <span className="text-[11px] text-[hsl(220,9%,46%)]">
                    Shown across the app
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="name">Business name</Label>
                    <Input
                      id="name"
                      required
                      placeholder="Acme Logistics"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="h-11"
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">
                      Tagline{" "}
                      <span className="text-[11px] text-[hsl(220,9%,46%)] font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="tagline"
                      placeholder="Fast, reliable delivery."
                      maxLength={80}
                      value={form.tagline}
                      onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-start">
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <LogoUpload
                      value={form.logoUrl}
                      businessName={form.name}
                      onFile={handleLogoPicked}
                      onRemove={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                    />
                    <p className="text-[11px] text-[hsl(220,9%,46%)]">
                      Stored on this device so the workspace stays branded
                      whenever you sign in here.
                    </p>
                  </div>

                  {/* Sidebar preview — mirrors what the actual app sidebar
                      looks like so the upload feels real. */}
                  <div className="space-y-2 md:w-[180px]">
                    <Label className="text-[hsl(220,9%,46%)]">Preview</Label>
                    <div className="border border-border bg-white">
                      <div className="flex items-center gap-2 px-3 h-12 border-b border-border">
                        {form.logoUrl ? (
                          <img
                            src={form.logoUrl}
                            alt=""
                            aria-hidden="true"
                            className="h-6 w-auto object-contain max-w-[72px]"
                          />
                        ) : (
                          <div className="h-6 w-6 flex items-center justify-center bg-[hsl(220,20%,10%)] flex-shrink-0">
                            <span className="text-white text-[10px] font-bold leading-none">
                              {previewInitial}
                            </span>
                          </div>
                        )}
                        <span className="text-xs font-semibold truncate">
                          {previewName}
                        </span>
                      </div>
                      <div className="px-3 py-2 space-y-1">
                        <div className="h-1.5 w-3/4 bg-[hsl(220,9%,90%)]" />
                        <div className="h-1.5 w-1/2 bg-[hsl(220,9%,90%)]" />
                        <div className="h-1.5 w-2/3 bg-[hsl(220,9%,90%)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ─── Business details block ─────────────────────────────── */}
              <section className="space-y-4 pt-2 border-t border-[hsl(220,9%,90%)]">
                <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[hsl(220,9%,30%)] pt-4">
                  About your business
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select
                      value={form.industry}
                      onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}
                    >
                      <SelectTrigger id="industry" className="h-11" data-testid="select-industry">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((i) => (
                          <SelectItem key={i} value={i}>
                            {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employeeCount">Number of employees</Label>
                    <Select
                      value={form.employeeCount}
                      onValueChange={(v) => setForm((f) => ({ ...f, employeeCount: v }))}
                    >
                      <SelectTrigger id="employeeCount" className="h-11" data-testid="select-employees">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYEE_RANGES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Johannesburg, South Africa"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="h-11"
                    data-testid="input-location"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Business phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+27 11 123 4567"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="h-11"
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website</Label>
                    <Input
                      id="websiteUrl"
                      type="url"
                      placeholder="https://yourcompany.co.za"
                      value={form.websiteUrl}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, websiteUrl: e.target.value }))
                      }
                      className="h-11"
                      data-testid="input-website"
                    />
                  </div>
                </div>
              </section>

              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px] mt-2"
                data-testid="button-finish"
              >
                {updateMutation.isPending ? "Saving…" : "Finish setup"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
