import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";

import DashboardPage from "@/pages/dashboard";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import AuditLogsPage from "@/pages/audit-logs";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#2563eb",
    colorBackground: "#ffffff",
    borderRadius: "0px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white w-[420px] max-w-full overflow-hidden border border-gray-200",
    card: "!shadow-none !border-0 !bg-transparent",
    footer: "!shadow-none !border-0 !bg-transparent",
  },
};

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 400, MAX_H = 200;
        const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png", 0.85));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function LogoUploadZone() {
  const { logoUrl, setLogoUrl, businessName, setBusinessName } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Please use an image under 5 MB."); return; }
    const dataUrl = await compressImageFile(file);
    setLogoUrl(dataUrl);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {logoUrl ? (
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white px-6 py-4 flex items-center justify-center">
            <img src={logoUrl} alt="Your logo" className="max-h-16 max-w-[220px] object-contain" />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
          >
            Change logo
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="w-full border-2 border-dashed border-neutral-700 hover:border-neutral-500 px-8 py-8 flex flex-col items-center gap-2 transition-colors group cursor-pointer"
        >
          <div className="h-10 w-10 border border-neutral-700 group-hover:border-neutral-500 flex items-center justify-center mb-1 transition-colors">
            <svg className="h-5 w-5 text-neutral-500 group-hover:text-neutral-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="square" strokeLinejoin="miter" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-neutral-300 group-hover:text-white transition-colors">Upload your logo</p>
          <p className="text-xs text-neutral-600">PNG, JPG, SVG · drag & drop or click</p>
        </button>
      )}

      <div className="w-full">
        <input
          type="text"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          placeholder="Your business name"
          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder:text-neutral-600 px-4 py-2.5 text-sm text-center focus:outline-none focus:border-neutral-600 transition-colors"
        />
      </div>
    </div>
  );
}

function BrandedHeader({ compact = false }: { compact?: boolean }) {
  const { logoUrl, businessName } = useTheme();

  if (logoUrl) {
    return (
      <div className={`flex flex-col items-center gap-2 ${compact ? "mb-6" : "mb-10"}`}>
        <img src={logoUrl} alt={businessName} className="max-h-12 max-w-[180px] object-contain" />
        {businessName && (
          <p className="text-xs tracking-widest uppercase text-neutral-500">{businessName}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${compact ? "mb-6" : "mb-10"}`}>
      <div className="h-10 w-10 bg-primary flex items-center justify-center">
        <span className="text-white font-bold text-lg">
          {businessName?.[0]?.toUpperCase() ?? "O"}
        </span>
      </div>
      <div className="text-center">
        <p className="text-xs tracking-[0.25em] uppercase text-neutral-500 mb-0.5">
          {businessName || "Olyxee Enterprise"}
        </p>
        <p className="text-sm font-semibold text-neutral-200">Logistics Console</p>
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-neutral-950 text-neutral-100 px-6 py-16">
          <div className="w-full max-w-sm flex flex-col items-center text-center">

            <BrandedHeader />

            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-neutral-400 mb-10">
              Personalize your console, then sign in to manage your shipments.
            </p>

            <LogoUploadZone />

            <a
              href={`${basePath}/sign-in`}
              className="mt-8 w-full inline-flex h-11 items-center justify-center bg-white text-neutral-950 px-8 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Sign In to Console
            </a>

            <a
              href={`${basePath}/sign-up`}
              className="mt-3 w-full inline-flex h-11 items-center justify-center border border-neutral-800 text-neutral-300 px-8 text-sm font-medium hover:border-neutral-600 hover:text-white transition-colors"
            >
              Create Account
            </a>

            <p className="mt-12 text-[11px] text-neutral-700 tracking-widest uppercase">
              Powered by Olyxee
            </p>
          </div>
        </div>
      </Show>
    </>
  );
}

function SignInPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-neutral-950 px-4 py-16">
      <BrandedHeader compact />
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <p className="mt-10 text-[11px] text-neutral-700 tracking-widest uppercase">
        Powered by Olyxee
      </p>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-neutral-950 px-4 py-16">
      <BrandedHeader compact />
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      <p className="mt-10 text-[11px] text-neutral-700 tracking-widest uppercase">
        Powered by Olyxee
      </p>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
          <Route path="/customers" component={() => <ProtectedRoute component={CustomersPage} />} />
          <Route path="/customers/:id" component={() => <ProtectedRoute component={CustomerDetailPage} />} />
          <Route path="/orders" component={() => <ProtectedRoute component={OrdersPage} />} />
          <Route path="/orders/:id" component={() => <ProtectedRoute component={OrderDetailPage} />} />
          <Route path="/audit-logs" component={() => <ProtectedRoute component={AuditLogsPage} />} />
          <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <TooltipProvider>
          <ClerkProviderWithRoutes />
          <Toaster />
        </TooltipProvider>
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
