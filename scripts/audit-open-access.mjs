/** Repository-wide audit of production client source for legacy paid access.
 * Intentionally excludes test fixtures, archived documents and references to
 * legitimate scientific 'pro' prefixes or Professional job titles.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, extname, relative } from "node:path";

const root = "src";
const findings = [];
const patterns = [
  /\bPro\b|\bpro\b/,
  /upgrade\\s+to|premium\\s+plan|subscription\\s+plan|paid\\s+tier/i,
  /requiresPro|isProMode|guardProModule|ProFeature|syncProAccessFromServer/,
  /vivasense_pro_access|vivasense-pro-redeem/,
];
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!["__tests__", "__mocks__", "fixtures"].includes(e.name)) walk(p);
    } else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(e.name)) &&
               !/\\.(?:test|spec)\\.[jt]sx?$/.test(e.name)) {
      const name = relative(".", p).replaceAll("\\\\", "/");
      const lines = readFileSync(p, "utf8").split("\\n");
      lines.forEach((line, i) => {
        if (!patterns.some(re => re.test(line))) return;
        // A single removal of a caller-provided obsolete header is allowed.
        if (name === "src/services/featureMode.ts" &&
            line.includes('headers.delete("X-VivaSense-Mode")')) return;
        findings.push(`${name}:${i + 1}: ${line.trim().slice(0, 200)}`);
      });
    }
  }
}
walk(root);
console.log(`[VivaSense free-access audit] ${findings.length} legacy paid-access mentions in production source`);
for (const line of findings) console.log("  " + line);
if (process.env.VIVASENSE_STRICT_ACCESS_AUDIT === "true" && findings.length) process.exitCode = 1;
