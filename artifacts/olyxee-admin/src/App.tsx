import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect, Link } from 'wouter';
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
    colorPrimary: "#111111",
    colorBackground: "#ffffff",
    borderRadius: "0px",
    fontFamily: "inherit",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full !shadow-none !border-0 !bg-transparent",
    card: "!shadow-none !border-0 !bg-transparent !p-0",
    footer: "!shadow-none !border-0 !bg-transparent",
    // Hide Clerk dev mode badge
    badge: "!hidden",
    developerMode: "!hidden",
  },
};

// ─── Image compression ────────────────────────────────────────────────────────
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

// ─── Logo upload (compact, light theme) ──────────────────────────────────────
function LogoUploadCompact() {
  const { logoUrl, setLogoUrl } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB."); return; }
    setLogoUrl(await compressImageFile(file));
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {logoUrl ? (
        <button onClick={() => fileRef.current?.click()} className="group flex flex-col items-center gap-1">
          <img src={logoUrl} alt="logo" className="max-h-10 max-w-[140px] object-contain" />
          <span className="text-[10px] text-gray-400 group-hover:text-gray-600 underline underline-offset-2 transition-colors">
            Change logo
          </span>
        </button>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 border border-dashed border-gray-300 hover:border-gray-400 px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="square" strokeLinejoin="miter" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Upload your logo
        </button>
      )}
    </div>
  );
}

// ─── Branded mark (light theme) ───────────────────────────────────────────────
function BrandMark() {
  const { logoUrl, businessName } = useTheme();
  if (logoUrl) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <img src={logoUrl} alt={businessName} className="max-h-10 max-w-[160px] object-contain" />
        {businessName && (
          <p className="text-[10px] tracking-widest uppercase text-gray-400">{businessName}</p>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 bg-gray-900 flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-sm">
          {businessName?.[0]?.toUpperCase() ?? "·"}
        </span>
      </div>
      {businessName && (
        <div>
          <p className="text-xs font-semibold text-gray-900 leading-tight">{businessName}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Enterprise Console</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────
function AuthTabs({ active }: { active: "sign-in" | "sign-up" }) {
  return (
    <div className="flex border-b border-gray-200 mb-6">
      <a
        href={`${basePath}/sign-in`}
        className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 -mb-px ${
          active === "sign-in"
            ? "border-gray-900 text-gray-900"
            : "border-transparent text-gray-400 hover:text-gray-600"
        }`}
      >
        Sign In
      </a>
      <a
        href={`${basePath}/sign-up`}
        className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 -mb-px ${
          active === "sign-up"
            ? "border-gray-900 text-gray-900"
            : "border-transparent text-gray-400 hover:text-gray-600"
        }`}
      >
        Create Account
      </a>
    </div>
  );
}

// ─── Auth card shell ──────────────────────────────────────────────────────────
function AuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">

        {/* Top: logo + upload */}
        <div className="flex items-center justify-between mb-8">
          <BrandMark />
          <LogoUploadCompact />
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 p-8">
          <AuthTabs active={mode} />

          {mode === "sign-in" ? (
            <SignIn
              routing="path"
              path={`${basePath}/sign-in`}
              signUpUrl={`${basePath}/sign-up`}
              appearance={clerkAppearance}
            />
          ) : (
            <SignUp
              routing="path"
              path={`${basePath}/sign-up`}
              signInUrl={`${basePath}/sign-in`}
              appearance={clerkAppearance}
            />
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-gray-300 tracking-widest uppercase">
          Powered by Olyxee
        </p>
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────
function SignInPage() {
  return <AuthCard mode="sign-in" />;
}

function SignUpPage() {
  return <AuthCard mode="sign-up" />;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout><Component /></AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

// ─── Clerk cache invalidation ─────────────────────────────────────────────────
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
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
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
