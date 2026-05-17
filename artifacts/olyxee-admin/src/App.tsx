import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useGetBusiness } from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";

import LoginPage from "@/pages/login";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import SettingsPage from "@/pages/settings";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({
  component: Component,
  skipOnboardingGuard = false,
  withLayout = true,
}: {
  component: React.ComponentType;
  skipOnboardingGuard?: boolean;
  withLayout?: boolean;
}) {
  const { status } = useAuth();
  const businessQuery = useGetBusiness({
    query: { enabled: status === "authenticated" } as never,
  });

  if (status === "loading") {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-background"
        role="status"
        aria-label="Loading"
      >
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }
  if (status === "unauthenticated") {
    return <Redirect to="/login" />;
  }

  if (!skipOnboardingGuard) {
    if (businessQuery.isLoading) {
      return (
        <div
          className="flex min-h-[100dvh] items-center justify-center bg-background"
          role="status"
          aria-label="Loading"
        >
          <Spinner className="size-6 text-primary" />
        </div>
      );
    }
    if (businessQuery.data && !businessQuery.data.onboardingCompleted) {
      return <Redirect to="/onboarding" />;
    }
  }

  if (!withLayout) return <Component />;
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function PublicOnly({ component: Component }: { component: React.ComponentType }) {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-background"
        role="status"
        aria-label="Loading"
      >
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }
  if (status === "authenticated") {
    return <Redirect to="/dashboard" />;
  }
  return <Component />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/"><Redirect to="/dashboard" /></Route>
      <Route path="/login" component={() => <PublicOnly component={LoginPage} />} />
      <Route path="/signup"><Redirect to="/login" /></Route>
      <Route
        path="/onboarding"
        component={() => (
          <Protected component={OnboardingPage} skipOnboardingGuard withLayout={false} />
        )}
      />
      <Route path="/dashboard" component={() => <Protected component={DashboardPage} />} />
      <Route path="/customers" component={() => <Protected component={CustomersPage} />} />
      <Route path="/customers/:id" component={() => <Protected component={CustomerDetailPage} />} />
      <Route path="/orders" component={() => <Protected component={OrdersPage} />} />
      <Route path="/orders/:id" component={() => <Protected component={OrderDetailPage} />} />
      {/* Legacy /audit-logs URL — bounce to the new Settings → Activity tab. */}
      <Route path="/audit-logs">
        {() => {
          if (typeof window !== "undefined") {
            window.location.replace(`${basePath}/settings#activity`);
          }
          return null;
        }}
      </Route>
      <Route path="/settings" component={() => <Protected component={SettingsPage} />} />
      <Route path="/profile" component={() => <Protected component={ProfilePage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <TooltipProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <AppRoutes />
            </QueryClientProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
