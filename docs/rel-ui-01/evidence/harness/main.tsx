// TEST HARNESS ONLY (not committed): real RelationshipAnalysis page, real API
// client, real backend; the Supabase auth guard is the only thing bypassed.
import "@/index.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import RelationshipAnalysis from "@/pages/RelationshipAnalysis";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider>
      <BrowserRouter>
        <RelationshipAnalysis />
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>,
);
