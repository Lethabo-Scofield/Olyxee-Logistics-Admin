import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";

import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import DashboardPage from "@/pages/dashboard";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import AuditLogsPage from "@/pages/audit-logs";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({ component: Component }: { component: React.ComponentType }) {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (status === "unauthenticated") {
    return <Redirect to="/login" />;
  }
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
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
      <Route path="/signup" component={() => <PublicOnly component={SignupPage} />} />
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
