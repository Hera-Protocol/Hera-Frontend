import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import RequestAccess from "./pages/RequestAccess.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NewCase from "./pages/NewCase.tsx";
import CaseDetail from "./pages/CaseDetail.tsx";
import AuditLog from "./pages/AuditLog.tsx";
import Settings from "./pages/Settings.tsx";
import Cases from "./pages/Cases.tsx";
import Reports from "./pages/Reports.tsx";
import Keys from "./pages/Keys.tsx";
import NotFound from "./pages/NotFound.tsx";
import { HeraConfigProvider, useHeraConfig } from "@/lib/hera-config";

const queryClient = new QueryClient();

const RequireConnection = () => {
  const { isConfigured } = useHeraConfig();

  return isConfigured ? <Outlet /> : <RedirectToLogin />;
};

const RedirectToLogin = () => {
  const location = useLocation();

  return (
    <Navigate
      to="/login"
      replace
      state={{ from: `${location.pathname}${location.search}${location.hash}` }}
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HeraConfigProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/request-access" element={<RequestAccess />} />
            <Route element={<RequireConnection />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/new-case" element={<NewCase />} />
              <Route path="/dashboard/cases" element={<Cases />} />
              <Route path="/dashboard/reports" element={<Reports />} />
              <Route path="/dashboard/keys" element={<Keys />} />
              <Route path="/dashboard/case/:caseId" element={<CaseDetail />} />
              <Route path="/dashboard/audit" element={<AuditLog />} />
              <Route path="/dashboard/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </HeraConfigProvider>
  </QueryClientProvider>
);

export default App;
