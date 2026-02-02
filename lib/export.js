// lib/export.js
(function () {
  window.App = window.App || {};

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  // Map export field -> CSV header label
  function headerForField(field) {
    if (field === "raw") return "raw";
    if (field === "effectiveUrl") return "effective_url";
    if (field === "normalizedUrl") return "normalized_url";
    if (field === "filename") return "filename";
    if (field === "type") return "type";
    return field; // host/path/query/dedupeKey/source...
  }

  // Shape a row to the requested field list.
  function pickFields(row, fields) {
    const out = {};
    for (const f of fields) {
      if (f === "raw") out.raw = row.raw ?? "";
      else if (f === "effectiveUrl") out.effectiveUrl = row.effectiveUrl ?? "";
      else if (f === "normalizedUrl") out.normalizedUrl = row.normalizedUrl ?? "";
      else if (f === "filename") out.filename = row.filename ?? "";
      else if (f === "type") out.type = row.type ?? "";
      else out[f] = row[f]; // host/path/query/dedupeKey/source...
    }
    
    return out;
  
  }

  function normalizeExportFields(exportFields, fallback) {
    const fields = Array.isArray(exportFields) && exportFields.length ? exportFields : fallback;
    return Array.isArray(fields) && fields.length ? fields : fallback;
  }

  function buildCsvExport(rows, exportFields) {
    const fields = normalizeExportFields(exportFields, [
      "raw",
      "effectiveUrl",
      "normalizedUrl",
      "filename",
      "type",
    ]);

    const header = fields.map(headerForField).join(",");

    const lines = (rows || []).map((r) => {
      const picked = pickFields(r || {}, fields);
      return fields.map((k) => csvEscape(picked[k] ?? "")).join(",");
    });

    return [header, ...lines].join("\n") + "\n";
  }

  function buildJsonExport(rows, exportFields) {
    const fields = Array.isArray(exportFields) && exportFields.length ? exportFields : null;
    if (!fields) return JSON.stringify(rows || [], null, 2) + "\n";

    const shaped = (rows || []).map((r) => pickFields(r || {}, fields));
    return JSON.stringify(shaped, null, 2) + "\n";
  }

  // plan = { type, deduped: [{ raw, url, normalizedUrl? }, ...] }
  // - item.url is EFFECTIVE URL (post URL-mode)
  // - item.normalizedUrl is original normalized URL (if available)
  function buildExportRowsForBatch(plan, deps = {}) {
    const url = deps.url || window.App?.url;
    if (!url) throw new Error("buildExportRowsForBatch: missing deps.url (App.url)");

    const usedNames = new Set();
    const ext = url.getExtensionForType(plan?.type);

    return (plan?.deduped || []).map((item) => {
      const effectiveUrl = item?.url || "";
      const normalizedUrl = item?.normalizedUrl || effectiveUrl;

      let host = "";
      let path = "";
      let query = "";
      try {
        const u = new URL(effectiveUrl);
        host = u.host || "";
        path = u.pathname || "";
        query = (u.search || "").replace(/^\?/, "");
      } catch {
        // keep blanks
      }

      const baseName = url.ensureSafeFilename(url.safeBaseNameFromUrl(effectiveUrl), ext);
      const filename = url.makeUniqueFilename(baseName, usedNames);

      return {
        raw: item?.raw ?? "",

        effectiveUrl,
        normalizedUrl,

        filename,
        type: plan?.type || "html",

        host,
        path,
        query,

        dedupeKey: item?.dedupeKey || "",
        source: item?.source || "manual",
      };
    });
  }

  window.App.exporter = {
    csvEscape,
    buildCsvExport,
    buildJsonExport,
    buildExportRowsForBatch,
  };
})();
