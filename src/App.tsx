import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useUser } from "./context/UserContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import FormPage from "./pages/FormPage";
import FormSummaryPage from "./pages/FormSummaryPage";
import PreviewPage from "./pages/PreviewPage";
import ReportPage from "./pages/ReportPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user } = useUser();
  if (!user.name) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/compare" element={<Index />} />
            <Route path="/form" element={<FormPage />} />
            <Route path="/form-summary" element={<FormSummaryPage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
