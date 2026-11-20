/**
 * Simple Linear Regression Word report. Built from regressionReport(), the
 * same section/row/table/note model the workspace renders, so the numbers and
 * the wording in the workspace and the .docx cannot drift apart.
 */
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell,
  TableRow, TextRun, WidthType,
} from "docx";
import { regressionReport, type ReportTable, type SimpleRegressionResult } from "@/lib/simpleRegression";
import { PLOT_HEIGHT, PLOT_WIDTH, fittedLinePlotPng, residualPlotPng } from "@/lib/regressionPlotImage";

export interface RegressionPlotImages {
  fitted: Uint8Array | null;
  residual: Uint8Array | null;
}

export const PLOT_NOT_EMBEDDED_NOTE =
  "This plot could not be embedded in the report on this device; it is shown in the VivaSense workspace.";

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };

function wordTable(table: ReportTable): (Paragraph | Table)[] {
  const cell = (text: string, index: number, header: boolean) => new TableCell({
    borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
    children: [new Paragraph({
      alignment: index >= table.numericFrom && !header ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: header, size: 18 })],
    })],
  });
  return [
    new Paragraph({ children: [new TextRun({ text: table.caption, italics: true, size: 18 })], spacing: { before: 120, after: 60 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: table.columns.map((c, i) => cell(c, i, true)) }),
        ...table.rows.map((row) => new TableRow({ children: row.map((v, i) => cell(v, i, false)) })),
      ],
    }),
  ];
}

function plotBlock(title: string, png: Uint8Array | null): Paragraph[] {
  if (!png) return [new Paragraph({ children: [new TextRun({ text: `${title}: ${PLOT_NOT_EMBEDDED_NOTE}`, italics: true })] })];
  const width = 600;
  return [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({
      type: "png",
      data: png,
      transformation: { width, height: Math.round((width * PLOT_HEIGHT) / PLOT_WIDTH) },
      altText: { title, description: title, name: title },
    })],
  })];
}

export function buildRegressionDocument(result: SimpleRegressionResult, images: RegressionPlotImages): Document {
  const sections = regressionReport(result);
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: "VivaSense Stat | Simple Linear Regression", heading: HeadingLevel.TITLE }),
  ];
  for (const section of sections) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    for (const [label, value] of section.rows) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${label}  `, bold: true }), new TextRun(value)] }));
    }
    for (const table of section.tables ?? []) children.push(...wordTable(table));
    if (section.title === "Model and slope inference") {
      children.push(...plotBlock("Observed values and fitted line", images.fitted));
    }
    if (section.title === "Residual diagnostics") {
      children.push(...plotBlock("Residuals versus fitted values", images.residual));
    }
    for (const note of section.notes ?? []) children.push(new Paragraph({ text: note, spacing: { before: 80 } }));
  }
  return new Document({ sections: [{ children }] });
}

export async function regressionWordBlob(result: SimpleRegressionResult): Promise<Blob> {
  const [fitted, residual] = await Promise.all([fittedLinePlotPng(result), residualPlotPng(result)]);
  return Packer.toBlob(buildRegressionDocument(result, { fitted, residual }));
}

export async function downloadRegressionWord(result: SimpleRegressionResult) {
  const url = URL.createObjectURL(await regressionWordBlob(result));
  const link = document.createElement("a");
  link.href = url;
  link.download = "VivaSense_Simple_Linear_Regression.docx";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
