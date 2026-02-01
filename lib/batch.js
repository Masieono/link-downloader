// lib/batch.js
(function () {
  window.App = window.App || {};

  // ---------------------------------------------------------------------------
  // Batch parsing + planning
  //
  // This module is intentionally "dumb glue":
  // - parse text into lines
  // - normalize/validate each line into { raw, url, normalizedUrl }
  // - dedupe according to options
  // - return a stable "plan" used by ZIP / exports / batch-file builder
  //
  // IMPORTANT CONTRACT:
  // - The caller's normalizeUrl(raw) should return the *effective URL* you want to act on
  //   (e.g., after applying URL-mode / tracking-strip rules).
  // - If you also want to preserve the "original normalized" URL for exports/history,
  //   return it as normalizedUrl.
  // ---------------------------------------------------------------------------

  function parseBatchText(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /*
   * Turns raw lines into:
   * - valid:   [{ raw, url, normalizedUrl }]
   * - invalid: [{ raw, reason }]
   *
   * normalizeUrl(raw) -> { ok, url, normalizedUrl?, reason? }
   */
  function normalizeBatchUrls(rawLines, normalizeUrl) {
    const valid = [];
    const invalid = [];

    const normalizer =
      typeof normalizeUrl === "function"
        ? normalizeUrl
        : (raw) => ({ ok: false, reason: "normalizeUrl() not provided" });

    for (const raw of rawLines || []) {
      const n = normalizer(raw);
      if (n && n.ok) {
        valid.push({
          raw,
          url: n.url,
          normalizedUrl: n.normalizedUrl || n.url, // keep a stable export value
        });
      } else {
        invalid.push({
          raw,
          reason: (n && n.reason) || "Invalid URL",
        });
      }
    }

    return { valid, invalid };
  }

  /*
   * Dedupe by a derived key (keeps first occurrence).
   * Returns { items, removedCount }.
   */
  function applyBatchDedupe(urlItems, options) {
    if (!options?.dedupe) return { items: urlItems || [], removedCount: 0 };

    const mode = options?.dedupeMode || "exact";
    const seen = new Set();
    const out = [];
    let removed = 0;

    for (const item of urlItems || []) {
      const urlStr = item?.url || "";
      const key = dedupeKey(urlStr, mode);

      if (seen.has(key)) {
        removed++;
        continue;
      }
      seen.add(key);
      out.push(item);
    }

    return { items: out, removedCount: removed };
  }

  /*
   * Build a "dedupe key" for an already-effective URL.
   * Modes:
   * - exact:      full URL string (but with hostname lowercased via URL parsing)
   * - loose:      exact + strip leading www + default ports + normalize trailing slash
   * - aggressive: loose + collapse multiple slashes + sort query params
   */
  function dedupeKey(urlStr, mode = "exact") {
    try {
      const u = new URL(String(urlStr || ""));

      // Normalize host casing
      u.hostname = u.hostname.toLowerCase();

      if (mode === "exact") return u.toString();

      // Loose: remove leading www.
      if (u.hostname.startsWith("www.")) u.hostname = u.hostname.slice(4);

      // Remove default ports
      if (
        (u.protocol === "http:" && u.port === "80") ||
        (u.protocol === "https:" && u.port === "443")
      ) {
        u.port = "";
      }

      // Normalize trailing slash
      if (u.pathname !== "/" && u.pathname.endsWith("/")) {
        u.pathname = u.pathname.slice(0, -1);
      }

      if (mode === "loose") return u.toString();

      // Aggressive: collapse multiple slashes in path
      u.pathname = u.pathname.replace(/\/{2,}/g, "/");

      // Aggressive: sort query params (param order differences become identical)
      if (u.search) {
        const params = Array.from(u.searchParams.entries());
        params.sort(([aK, aV], [bK, bV]) =>
          aK === bK ? aV.localeCompare(bV) : aK.localeCompare(bK)
        );
        u.search = new URLSearchParams(params).toString();
      }

      return u.toString();
    } catch {
      // If it's not a URL, fall back to raw string
      return String(urlStr || "");
    }
  }

  /*
   * Centralized batch plan builder (used by ZIP + CSV + JSON + batch file)
   *
   * deps:
   *  - batchInputEl: textarea element
   *  - zipNameInputEl: input element
   *  - getBatchOptions(): -> { dedupe, dedupeMode, exportCsv, exportJson, exportFields, ... }
   *  - normalizeUrl(raw): -> { ok, url, normalizedUrl?, reason? }
   *  - getSelectedType(): -> "html" | "url" | "webloc"
   */
  function buildPlanFromUI(deps) {
    const {
      batchInputEl,
      zipNameInputEl,
      getBatchOptions,
      normalizeUrl,
      getSelectedType,
    } = deps || {};

    const lines = parseBatchText(batchInputEl?.value || "");

    const options =
      typeof getBatchOptions === "function"
        ? getBatchOptions()
        : { dedupe: true, dedupeMode: "exact", exportCsv: true, exportJson: true };

    const { valid, invalid } = normalizeBatchUrls(lines, normalizeUrl);
    const { items: deduped, removedCount } = applyBatchDedupe(valid, options);

    const zipBaseName = (zipNameInputEl?.value || "links").trim() || "links";

    return {
      lines,
      options,
      valid,
      invalid,
      deduped,
      removedCount,
      type: typeof getSelectedType === "function" ? getSelectedType() : "html",
      zipBaseName,
    };
  }

  window.App.batch = {
    parseBatchText,
    normalizeBatchUrls,
    applyBatchDedupe,
    buildPlanFromUI,
  };
})();