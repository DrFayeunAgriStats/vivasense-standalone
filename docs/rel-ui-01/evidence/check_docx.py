import json, re, sys, zipfile
from pathlib import Path
sys.path.insert(0, sys.argv[2])
from docx import Document
from genetics_export import _fmt, _fmt_p
OUT = Path(sys.argv[1]); report = {}
for name in ("general_pearson_a005", "general_spearman_a010"):
    res = json.loads((OUT / f"{name}.response.json").read_text())
    shown = (OUT / f"{name}.displayed.txt").read_text()
    f = OUT / f"{name}.docx"
    chk = {}
    with zipfile.ZipFile(f) as z:
        chk["zip_ok"] = z.testzip() is None
        chk["has_document_xml"] = "word/document.xml" in z.namelist()
        chk["content_types_ok"] = "wordprocessingml" in z.read("[Content_Types].xml").decode()
    doc = Document(str(f))
    parts = [p.text for p in doc.paragraphs]
    for t in doc.tables:
        for row in t.rows:
            parts.append(" | ".join(c.text for c in row.cells))
    text = "\n".join(parts)
    rows = [l for l in text.splitlines() if l.count(" | ") >= 6]
    pair_ok = []
    for e in res["pair_results"]:
        exp = " | ".join([e["trait_1"], e["trait_2"], _fmt(e["r"], 3, thousands=False), str(e["n"]),
                          _fmt_p(e["p_raw"]), _fmt_p(e["p_adjusted"]), "yes" if e["significant_adjusted"] else "no"])
        pair_ok.append({"pair": f'{e["trait_1"]}-{e["trait_2"]}', "in_docx": exp in rows,
                        "r_shown_in_ui": f'{e["r"]:.3f}' in shown, "n_shown_in_ui": f'n={e["n"]}' in shown,
                        "fdr_shown_in_ui": (f'FDR p={e["p_adjusted"]:.4f}' in shown) if e["p_adjusted"] >= 0.001 else ("FDR p=<0.001" in shown)})
    meth = "Spearman" if res["method"] == "spearman" else "Pearson"
    chk.update({
        "pairs": pair_ok,
        "method_label_docx": meth in text, "method_label_ui": meth in shown,
        "alpha_docx": bool(re.search(r"(Significance level \(α\)|α\))\D{0,6}" + re.escape(str(res["alpha"]).rstrip("0").rstrip(".") if res["alpha"] != 0.05 else "0.05"), text)),
        "bh_multiplicity_docx": f"Benjamini–Hochberg FDR across {res['multiplicity']['n_hypotheses']}" in text,
        "warnings_all_in_docx": all(w in text for w in res["warnings"]),
        "warnings_all_in_ui": all(w in shown for w in res["warnings"]),
        "n_warnings": len(res["warnings"]),
        "verified_statement": "verified as produced, unmodified, by this VivaSense backend" in text,
        "no_unverified": "UNVERIFIED" not in text,
        "causation_statement_docx": "does not establish causation" in text,
        "causation_statement_ui": "not causation" in shown,
        "not_significance_statement": "not statistical significance" in text,
        "no_persisted_identity_statement": "no persisted dataset version, execution identity" in text,
        "context_general": "Analysis context: general" in text,
        "declaration_not_declared": "Genetic-material declaration: not declared" in text,
        "heatmap_embedded": len(doc.inline_shapes) >= 1,
        "interpretation_regenerated": res.get("interpretation", "")[:40] in text if res.get("interpretation") else None,
    })
    report[name] = chk
print(json.dumps(report, indent=1, ensure_ascii=False))
