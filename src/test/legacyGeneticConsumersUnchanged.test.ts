/**
 * REL-UI-01 Phase A (Option B): legacy genetic consumers must keep their
 * production (c8381e4) git blob identity. The General workflow is additive.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const PRODUCTION_BLOBS: Record<string, string> = {
  "src/pages/RelationshipAnalysis.tsx": "32f9f6d64376747ec1978958f3e6779fab4bc498",
  "src/lib/relationshipCorrelationRequest.ts": "06ce8482e24e4b89f8127de710749b716aca9aab",
  "src/lib/geneticsUploadApi.ts": "4e225e0d43e6ff8fbb82d18b85e9efab94081654",
  "src/services/traitRelationshipsApi.ts": "c77343e597361dc1a24d7704e6492f3c14633515",
  "src/components/vivasense/advanced/TraitAssociationPanel.tsx": "258cb882f259aa294627334acc713b21b612ec68",
  "src/components/vivasense/genetics-params/CorrelationHeatmap.tsx": "3c49845ac7e559774f036e591722b27604c3ddff",
  "src/types/traitAssociation.ts": "47ad7f417045c6b376ceba648c39c1e932ac0bbc",
};

function gitBlob(path: string): string {
  const data = readFileSync(resolve(__dirname, "../..", path));
  return createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
}

describe("legacy genetic consumers are unchanged", () => {
  for (const [path, blob] of Object.entries(PRODUCTION_BLOBS)) {
    it(path, () => expect(gitBlob(path)).toBe(blob));
  }
});
