import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
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

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(220, 20%, 10%)",
    colorForeground: "hsl(220, 20%, 10%)",
    colorMutedForeground: "hsl(220, 9%, 46%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInput: "hsl(0, 0%, 100%)",
    colorInputForeground: "hsl(220, 20%, 10%)",
    colorNeutral: "hsl(220, 13%, 88%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white border border-[hsl(220,13%,88%)] w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(220,20%,10%)] text-2xl font-bold",
    headerSubtitle: "text-[hsl(220,9%,46%)]",
    socialButtonsBlockButtonText: "text-[hsl(220,20%,10%)] font-medium",
    formFieldLabel: "text-[hsl(220,20%,10%)] font-medium",
    footerActionLink: "text-[hsl(220,20%,10%)] font-medium underline",
    footerActionText: "text-[hsl(220,9%,46%)]",
    dividerText: "text-[hsl(220,9%,46%)]",
    identityPreviewEditButton: "text-[hsl(220,20%,10%)]",
    formFieldSuccessText: "text-green-600",
    alertText: "text-[hsl(220,20%,10%)]",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-8 w-auto",
    socialButtonsBlockButton:
      "border border-[hsl(220,13%,88%)] hover:bg-[hsl(220,13%,96%)]",
    formButtonPrimary:
      "bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium",
    formFieldInput:
      "bg-white border border-[hsl(220,13%,88%)] text-[hsl(220,20%,10%)]",
    footerAction: "",
    dividerLine: "bg-[hsl(220,13%,88%)]",
    alert: "border border-[hsl(220,13%,88%)] bg-[hsl(220,13%,96%)]",
    otpCodeFieldInput:
      "bg-white border border-[hsl(220,13%,88%)] text-[hsl(220,20%,10%)]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function Protected({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/"><Redirect to="/dashboard" /></Route>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/dashboard" component={() => <Protected component={DashboardPage} />} />
      <Route path="/customers" component={() => <Protected component={CustomersPage} />} />
      <Route path="/customers/:id" component={() => <Protected component={CustomerDetailPage} />} />
      <Route path="/orders" component={() => <Protected component={OrdersPage} />} />
      <Route path="/orders/:id" component={() => <Protected component={OrderDetailPage} />} />
      <Route path="/audit-logs" component={() => <Protected component={AuditLogsPage} />} />
      <Route path="/settings" component={() => <Protected component={SettingsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={`${basePath}/dashboard`}
      signUpFallbackRedirectUrl={`${basePath}/dashboard`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Olyxee admin account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Get started with Olyxee Logistics",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
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
