/** File-export helpers shared by analysis panels (Manus PCA audit D07, D14). */

/**
 * Canvas size for an aspect-preserving PNG export: the SVG's own viewBox (or rendered size) multiplied by ONE factor,
 * so geometry (for example equal-unit biplot axes) is not distorted.  Manus PCA audit D07.
 */
export function aspectPreservingPngSize(svg: SVGSVGElement): { width: number; height: number; scale: number } {
  const vb = svg.viewBox?.baseVal;
  const rect = svg.getBoundingClientRect();
  const w = vb && vb.width ? vb.width : rect.width || 800;
  const h = vb && vb.height ? vb.height : rect.height || 500;
  const scale = 2 * Math.max(1, 1000 / w);
  return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
}

/** Download a JSON document (full precision; used for result manifests). */
export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
