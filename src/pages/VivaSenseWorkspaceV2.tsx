/**
 * /workspace-v2 — standalone route for the V3 dashboard. Kept for direct access
 * and bookmarks; the same dashboard is now also the default overview inside
 * /workspace (VivaSenseWorkspace "selection" view). Both render the shared
 * WorkspaceV3Dashboard, so they never drift apart.
 */
import { Layout } from "@/components/layout/Layout";
import { WorkspaceV3Dashboard } from "@/components/vivasense/workspace/v3/WorkspaceV3Dashboard";

export default function VivaSenseWorkspaceV2() {
  return (
    <Layout>
      <WorkspaceV3Dashboard />
    </Layout>
  );
}
