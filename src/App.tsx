import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/request-access" element={<RequestAccess />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/new-case" element={<NewCase />} />
          <Route path="/dashboard/cases" element={<Cases />} />
          <Route path="/dashboard/reports" element={<Reports />} />
          <Route path="/dashboard/keys" element={<Keys />} />
          <Route path="/dashboard/case/:caseId" element={<CaseDetail />} />
          <Route path="/dashboard/audit" element={<AuditLog />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
