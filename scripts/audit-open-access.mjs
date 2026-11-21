/** Audit production source for obsolete paid-tier terminology and access code. */
import { readdirSync, readFileSync } from "node:fs";
import { join, extname, relative } from "node:path";

const findings = [];
const patterns = [
  /\bPro\b|\bpro\b/,
  /upgrade\s+to|premium\s+plan|subscription\s+plan|paid\s+tier/i,
  /requiresPro|isProMode|guardProModule|ProFeature|syncProAccessFromServer/,
  /vivasense_pro_access|vivasense-pro-redeem/,
];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["__tests__", "__mocks__", "fixtures"].includes(entry.name)) walk(fullPath);
    } else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(entry.name)) &&
               !/\.(?:test|spec)\.[jt]sx?$/.test(entry.name)) {
      const name = relative(".", fullPath).replaceAll("\\", "/");
      const lines = readFileSync(fullPath, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!patterns.some(re => re.test(line))) return;
        // Remove any caller-provided obsolete tier header rather than forwarding it.
        if (name === "src/services/featureMode.ts" &&
            line.includes('headers.delete("X-VivaSense-Mode")')) return;
        findings.push(name + ":" + (i + 1) + ": " + line.trim().slice(0, 200));
      });
    }
  }
}
walk("src");
console.log("[VivaSense free-access audit] " + findings.length + " legacy paid-tier mentions in production source");
for (const line of findings) console.log("  " + line);
if (process.env.VIVASENSE_STRICT_ACCESS_AUDIT === "true" && findings.length) process.exitCode = 1;
