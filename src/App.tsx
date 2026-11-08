import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { VivaSenseAuthGuard } from "@/components/vivasense/VivaSenseAuthGuard";
import VivaSenseAuth from "@/pages/VivaSenseAuth";
import VivaSenseWorkspace from "@/pages/VivaSenseWorkspace";
import GeneralCorrelationAnalysis from "@/pages/GeneralCorrelationAnalysis";
import DataCapture from "@/pages/DataCapture";
import HelpLearning from "@/pages/HelpLearning";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

import { AskVivaSense } from "@/components/help/AskVivaSense";

const queryClient = new QueryClient();

function SupportPilot() {
  const { user, loading } = useAuth();
  return user && !loading ? <AskVivaSense key={user.id} /> : null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<VivaSenseAuth />} />
            <Route
              path="/workspace"
              element={
                <VivaSenseAuthGuard>
                  <VivaSenseWorkspace />
                </VivaSenseAuthGuard>
              }
            />
            <Route
              path="/relationship-analysis/general"
              element={
                <VivaSenseAuthGuard>
                  <GeneralCorrelationAnalysis />
                </VivaSenseAuthGuard>
              }
            />
            {/* V3 is now the default /workspace overview; keep this path as a
                redirect so existing /workspace-v2 links/bookmarks still work. */}
            <Route path="/workspace-v2" element={<Navigate to="/workspace" replace />} />
            <Route
              path="/data-capture"
              element={
                <VivaSenseAuthGuard>
                  <DataCapture />
                </VivaSenseAuthGuard>
              }
            />
            <Route
              path="/help"
              element={
                <VivaSenseAuthGuard>
                  <HelpLearning />
                </VivaSenseAuthGuard>
              }
            />
            <Route
              path="/help/:tutorialSlug"
              element={
                <VivaSenseAuthGuard>
                  <HelpLearning />
                </VivaSenseAuthGuard>
              }
            />
            <Route path="/" element={<Navigate to="/workspace" replace />} />
          </Routes>
          {import.meta.env.VITE_ASK_VIVASENSE !== "false" && (
            <SupportPilot />
          )}
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
