/**
 * Export a study's collected data as an analysis-ready Excel workbook.
 * Reuses the existing xlsx dependency. Header row is first so the file uploads
 * straight into VivaSense's analysis engine (Genotype / Replication / traits).
 */
import * as XLSX from "xlsx";
import type { CollectedDataset } from "@/services/dataCapture/dataCaptureService";

export function downloadCollectedData(dataset: CollectedDataset, filename: string): void {
  const aoa = [dataset.headers, ...dataset.rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = dataset.headers.map((h) => ({ wch: h === "Genotype" ? 16 : 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}
