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

  const [form, setForm] = useState({
    name: "",
    industry: "",
    employeeCount: "",
    location: "",
    phone: "",
    websiteUrl: "",
  });

  // Hydrate from existing business once loaded so partially-filled onboarding
  // resumes where the user left off.
  useEffect(() => {
    if (!business) return;
    setForm((f) => ({
      name: business.name ?? f.name,
      industry: business.industry ?? f.industry,
      employeeCount: business.employeeCount ?? f.employeeCount,
      location: business.location ?? f.location,
      phone: business.phone ?? f.phone,
      websiteUrl: business.websiteUrl ?? f.websiteUrl,
    }));
  }, [business]);

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
      toast.success("Welcome aboard");
      setLocation("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your business details",
      );
    }
  }

  return (
    <div
      className="relative min-h-[100dvh] bg-[hsl(220,20%,10%)] bg-cover bg-center"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Blurred image layer + dark gradient so the form floats over the photo */}
      <div className="absolute inset-0 backdrop-blur-md bg-black/55" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[640px] items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 px-8 py-10">
          <div className="mb-8">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-[hsl(220,9%,46%)]">
              Step 2 of 2
            </p>
            <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight mt-2">
              Tell us about your business
            </h1>
            <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5">
              We'll tailor your dashboard with these details. You can change them
              later in Settings.
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your account…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-onboarding">
              <div className="space-y-2">
                <Label htmlFor="name">Business name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-11"
                  data-testid="input-name"
                />
              </div>

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
