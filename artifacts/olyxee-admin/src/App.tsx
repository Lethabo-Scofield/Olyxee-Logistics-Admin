import { Switch, Route, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({ component: Component }: { component: React.ComponentType }) {
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <Switch>
              <Route path="/"><Redirect to="/dashboard" /></Route>
              <Route path="/dashboard" component={() => <Protected component={DashboardPage} />} />
              <Route path="/customers" component={() => <Protected component={CustomersPage} />} />
              <Route path="/customers/:id" component={() => <Protected component={CustomerDetailPage} />} />
              <Route path="/orders" component={() => <Protected component={OrdersPage} />} />
              <Route path="/orders/:id" component={() => <Protected component={OrderDetailPage} />} />
              <Route path="/audit-logs" component={() => <Protected component={AuditLogsPage} />} />
              <Route path="/settings" component={() => <Protected component={SettingsPage} />} />
              <Route component={NotFound} />
            </Switch>
          </QueryClientProvider>
          <Toaster />
        </TooltipProvider>
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
