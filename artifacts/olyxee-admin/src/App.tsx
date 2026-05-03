import { useEffect, useRef, useState } from "react";
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
    // Hide Clerk's footer and footer actions — they contain the dev mode
    // badge and duplicate sign-in/sign-up links. We render our own below.
    footer: "!hidden",
    footerAction: "!hidden",
    footerPages: "!hidden",
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
  const { logoUrl, setLogoUrl, businessName, setBusinessName } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showSetup, setShowSetup] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB."); return; }
    setLogoUrl(await compressImageFile(file));
  };

  if (logoUrl && !showSetup) {
    return (
      <button
        onClick={() => setShowSetup(true)}
        className="group flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
        </svg>
        Edit branding
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { e.target.files?.[0] && handleFile(e.target.files[0]); }} />

      <div className="bg-white border border-gray-200 shadow-sm p-3 flex flex-col gap-2.5 w-56">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Brand setup</p>

        <input
          type="text"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          placeholder="Business name"
          className="w-full border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
        />

        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-gray-500 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors w-full"
        >
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="square" strokeLinejoin="miter" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {logoUrl ? "Change logo" : "Upload logo"}
        </button>

        {logoUrl && (
          <div className="flex items-center gap-2 border border-gray-100 px-2 py-1.5 bg-gray-50">
            <img src={logoUrl} alt="logo" className="max-h-6 max-w-[80px] object-contain" />
            <button
              onClick={() => setLogoUrl("")}
              className="ml-auto text-[10px] text-gray-400 hover:text-red-500 transition-colors"
            >
              Remove
            </button>
          </div>
        )}

        {(logoUrl || businessName) && (
          <button
            onClick={() => setShowSetup(false)}
            className="text-[10px] text-gray-400 hover:text-gray-600 text-right transition-colors"
          >
            Done
          </button>
        )}
      </div>
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

// ─── Auth card shell ──────────────────────────────────────────────────────────
function AuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isSignIn = mode === "sign-in";

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">

        {/* Top: logo + upload */}
        <div className="flex items-center justify-between mb-8">
          <BrandMark />
          <LogoUploadCompact />
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {isSignIn ? "Sign in to your account" : "Create your account"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSignIn
              ? "Enter your credentials to access the console."
              : "Get started — it only takes a moment."}
          </p>
        </div>

        {/* Clerk form */}
        <div className="bg-white border border-gray-200 p-8">
          {isSignIn ? (
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

        {/* Switch link */}
        <p className="mt-5 text-center text-sm text-gray-500">
          {isSignIn ? (
            <>
              Don't have an account?{" "}
              <a href={`${basePath}/sign-up`} className="font-medium text-gray-900 hover:underline underline-offset-2">
                Create one
              </a>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <a href={`${basePath}/sign-in`} className="font-medium text-gray-900 hover:underline underline-offset-2">
                Sign in
              </a>
            </>
          )}
        </p>

        {/* Footer */}
        <p className="mt-8 text-center text-[10px] text-gray-300 tracking-widest uppercase">
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
