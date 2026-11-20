// TEST-ONLY harness (not part of the production build): mounts the REAL advanced-analysis dashboard on a dataset token issued by a real backend.
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AdvancedAnalysisDashboard } from "@/components/vivasense/advanced/AdvancedAnalysisDashboard";
import "@/index.css";

const q = new URLSearchParams(location.search);
const ctx = { file: new File(["x"], "data.csv"), base64Content: "", fileType: "csv" as const, genotypeColumn: "Genotype", repColumn: "rep",
  environmentColumn: "Env", availableTraitColumns: (q.get("traits") ?? "Yield").split(","), mode: (q.get("mode") ?? "multi") as "multi" | "single", datasetToken: q.get("token") };
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}><BrowserRouter>
    <div className="p-6 max-w-6xl mx-auto"><AdvancedAnalysisDashboard datasetContext={ctx as never} initialModule={(q.get("module") as never) ?? null} embedded /></div>
  </BrowserRouter></QueryClientProvider>
);
