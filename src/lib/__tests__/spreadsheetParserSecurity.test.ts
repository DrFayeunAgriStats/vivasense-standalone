/**
 * Spreadsheet parser regression and safety tests (issue #49: xlsx@0.18.5 advisories GHSA-4r6h-8v6p-xvw6 and
 * GHSA-5pgg-2g8v-p4x9).
 *
 * 1. Read parity: the four read sites call XLSX.read + sheet_to_json in exactly these two ways
 *    (VivaSenseGeneticsForm.tsx, VivaSenseForm.tsx, pages/GeneralCorrelationAnalysis.tsx: header:1, defval:"";
 *    lib/environmentValidation.ts: object rows, defval:"").  Results for synthetic CSV/XLSX/XLS fixtures are pinned to
 *    golden_0.18.5.json, produced by the currently shipped version BEFORE any upgrade, so that a parser upgrade must
 *    reproduce them exactly (or the difference must be reviewed and the golden file deliberately re-baselined).
 * 2. Global prototype integrity: parsing workbooks whose headers / values are "__proto__", "constructor" and
 *    "prototype" must not add or change anything on Object.prototype.  This is a defensive regression guard, NOT a
 *    reproduction of the advisories (no proof-of-concept payload is used or claimed).
 * 3. Parse-time smoke budget on long, quote-heavy cells.  Again a guard, not a ReDoS reproduction.
 *
 * Regenerate the golden file only on purpose:  UPDATE_SPREADSHEET_GOLDEN=1 npx vitest run <this file>
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { beforeAll, describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../../test/fixtures/spreadsheet-security");
const GOLDEN = path.join(DIR, "golden_0.18.5.json");
const FILES = ["mixed.csv", "mixed_bom.csv", "mixed.xlsx", "mixed.xls"];

async function readWorkbook(name: string, bytes: Uint8Array): Promise<XLSX.WorkBook> {
  // Exactly the app's path: a browser File; CSV via file.text() with type "string", everything else via
  // file.arrayBuffer() with type "array".  (A Node Buffer's ArrayBuffer comes from another realm under jsdom and is
  // misdetected by the parser, so the File API is used, as in the app.)
  const file = new File([new Uint8Array(bytes)], name);
  if (name.toLowerCase().endsWith(".csv")) return XLSX.read(await file.text(), { type: "string" });
  return XLSX.read(await file.arrayBuffer(), { type: "array" });
}

async function parse(name: string, bytes: Uint8Array) {
  const wb = await readWorkbook(name, bytes);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return {
    sheetNames: wb.SheetNames,
    rowsHeader1: XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }),
    rowsObjects: XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" }),
  };
}

const parsed: Record<string, ReturnType<typeof JSON.parse>> = {};
beforeAll(async () => {
  for (const f of FILES) parsed[f] = JSON.parse(JSON.stringify(await parse(f, fs.readFileSync(path.join(DIR, f)))));
  if (process.env.UPDATE_SPREADSHEET_GOLDEN === "1") {
    fs.writeFileSync(GOLDEN, JSON.stringify({ generated_with: XLSX.version, results: parsed }, null, 1) + "\n");
  }
});

describe("read parity with the golden results of xlsx@0.18.5", () => {
  const golden = () => JSON.parse(fs.readFileSync(GOLDEN, "utf8"));

  it("golden file was produced by 0.18.5", () => {
    expect(golden().generated_with).toBe("0.18.5");
  });
  for (const f of FILES) {
    it(`parses ${f} identically`, () => {
      expect(parsed[f]).toEqual(golden().results[f]);
    });
  }
  it("reads the workbook structure (both sheets) and keeps padded and Unicode headers verbatim", () => {
    for (const f of ["mixed.xlsx", "mixed.xls"]) {
      expect(parsed[f].sheetNames).toEqual(["Data", "Second"]);
      expect(parsed[f].rowsHeader1[0]).toContain("  Yield  ");
      expect(parsed[f].rowsHeader1[0]).toContain("Leaf area (cm²)");
      expect(parsed[f].rowsHeader1.length).toBe(5);
    }
  });
});

describe("global prototype integrity", () => {
  const HOSTILE = ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty"];
  const workbooks: Record<string, Uint8Array> = (() => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HOSTILE, HOSTILE, [1, 2, 3, 4, 5]]), "Data");
    return {
      "hostile.xlsx": new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer),
      "hostile.xls": new Uint8Array(XLSX.write(wb, { type: "array", bookType: "biff8" }) as ArrayBuffer),
      "hostile.csv": new TextEncoder().encode(XLSX.utils.sheet_to_csv(wb.Sheets.Data)),
    };
  })();
  for (const [name, bytes] of Object.entries(workbooks)) {
    it(`parsing ${name} leaves Object.prototype unchanged`, async () => {
      const before = Object.getOwnPropertyNames(Object.prototype).sort();
      const descriptors = Object.getOwnPropertyDescriptors(Object.prototype);
      const out = await parse(name, bytes);
      expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
      for (const k of before) expect(Object.getOwnPropertyDescriptor(Object.prototype, k)).toEqual(descriptors[k]);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(typeof ({}).toString).toBe("function");
      expect(out.rowsHeader1.length).toBe(3);
    });
  }
});

describe("parse-time smoke budget", () => {
  it("parses long, quote-heavy CSV cells within 3 s", async () => {
    const cell = '"' + 'a""b,'.repeat(20000) + '"';
    const csv = `A,B\n${cell},1\n${"x".repeat(100000)},2\n`;
    const t0 = performance.now();
    const out = await parse("long.csv", new TextEncoder().encode(csv));
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(out.rowsHeader1.length).toBe(3);
  });
});
