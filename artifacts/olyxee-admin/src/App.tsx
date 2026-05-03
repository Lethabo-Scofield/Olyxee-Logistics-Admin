import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { ThemeProvider } from "@/contexts/theme-context";

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

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
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
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-neutral-950 text-neutral-100 p-6 text-center">
          <div className="mb-10 flex flex-col items-center gap-3">
            <div className="h-10 w-10 bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <div>
              <p className="text-xs tracking-[0.25em] uppercase text-neutral-500 mb-1">Olyxee Enterprise</p>
              <h2 className="text-xl font-bold">Logistics Console</h2>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 max-w-xl">
            Command Center for Logistics
          </h1>
          <p className="text-base text-neutral-400 max-w-lg mb-10">
            Precise, professional, and built for teams who manage shipments, customers, and operations at scale.
          </p>
          <a
            href={`${basePath}/sign-in`}
            className="inline-flex h-11 items-center justify-center bg-primary px-8 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Sign In to Console
          </a>
          <p className="mt-12 text-[11px] text-neutral-600 tracking-widest uppercase">
            Powered by Olyxee
          </p>
        </div>
      </Show>
    </>
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
