// lib/import-files.js
(function () {
  window.App = window.App || {};

  let ctx = {
    urlInputEl: null,
    batchInputEl: null,
    zipNameInputEl: null,
    importAppendEl: null,
    // callbacks provided by app.js
    appendLinesToBatch: null,
    applyBatchFileToUI: null,
    isValidBatchFileObject: null,
    updatePreview: null,
  };

  function shouldReplaceOnImport() {
    // Default to replace if checkbox not present
    const append = !!ctx?.importAppendEl?.checked;
    return !append;
  }

  function init(c) {
    ctx = { ...ctx, ...(c || {}) };
  }

  // -------------------------
  // Small helpers
  // -------------------------

  function looksLikeHtml(text) {
    return /<html[\s>]|<!doctype\s+html/i.test(text || "");
  }

  // IMPORTANT: Imports never apply URL mode (strip tracking/all) at import time.
  // URL mode is applied later when building the batch plan / output.

  function normalizeAndDedupeUrls(urls) {
    const cleaned = (urls || [])
      .map((u) => String(u || "").trim())
      .filter(Boolean)
      .map((u) => {
        const n = App.url.normalizeUrl(u);
        return n.ok ? n.url : null;
      })
      .filter(Boolean);

    const seen = new Set();
    const unique = [];
    for (const u of cleaned) {
      if (seen.has(u)) continue;
      seen.add(u);
      unique.push(u);
    }
    return unique;
  }

  function normalizeExtractedUrl(u) {
    const out = normalizeAndDedupeUrls([u]);
    return out[0] || null; // IMPORTANT: do NOT apply URL mode at import time
  }

  // -------------------------
  // HTML parsing (.html link files + bookmarks export)
  // -------------------------

  function extractUrlsFromBookmarksHtml(htmlText) {
    const text = String(htmlText || "");

    // Netscape bookmark export signature (Chrome/Brave/Edge commonly)
    const isBookmarks =
      /NETSCAPE-Bookmark-file/i.test(text) ||
      /<DL[^>]*>/i.test(text) ||
      /<H3[^>]*>/i.test(text);

    if (!isBookmarks) return [];

    const urls = [];
    const re = /<a[^>]+href\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(text))) urls.push(m[1]);
    return urls;
  }

  function extractUrlsFromHtmlFile(htmlText) {
    const text = String(htmlText || "");

    // 1) meta refresh redirect
    let m = text.match(/http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*url\s*=\s*([^"']+)["']/i);
    if (m?.[1]) return [m[1].trim()];

    m = text.match(/content\s*=\s*["'][^"']*url\s*=\s*([^"']+)["']/i);
    if (m?.[1]) return [m[1].trim()];

    // 2) JS redirect
    m = text.match(/window\.location\.(?:replace|assign)\(\s*["']([^"']+)["']\s*\)/i);
    if (m?.[1]) return [m[1].trim()];

    m = text.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);
    if (m?.[1]) return [m[1].trim()];

    // 3) Bookmarks export
    const bookmarkUrls = extractUrlsFromBookmarksHtml(text);
    if (bookmarkUrls.length) return bookmarkUrls;

    // 4) First anchor
    m = text.match(/<a[^>]+href\s*=\s*["']([^"']+)["']/i);
    if (m?.[1]) return [m[1].trim()];

    // 5) First http(s) URL anywhere
    m = text.match(/\bhttps?:\/\/[^\s"'<>]+/i);
    if (m?.[0]) return [m[0].trim()];

    return [];
  }

  // -------------------------
  // .url / .webloc
  // -------------------------

  function extractUrlFromWindowsUrlFile(text) {
    const t = String(text || "");
    const m = t.match(/^\s*URL\s*=\s*(.+)\s*$/im);
    if (!m?.[1]) return null;
    return normalizeExtractedUrl(m[1].trim());
  }

  function extractUrlFromWeblocFile(text) {
    const t = String(text || "");
    let m = t.match(/<key>\s*URL\s*<\/key>\s*<string>\s*([^<]+)\s*<\/string>/i);
    if (m?.[1]) return normalizeExtractedUrl(m[1].trim());

    m = t.match(/<string>\s*(https?:\/\/[^<]+)\s*<\/string>/i);
    if (m?.[1]) return normalizeExtractedUrl(m[1].trim());

    return null;
  }

  // -------------------------
  // CSV URL parsing (import-related)
  // -------------------------

  function parseCsvForUrls(csvText) {
    const text = String(csvText || "");
    if (!text.trim()) return [];

    // --- delimiter sniff (ignores commas inside quotes) ---
    function sniffDelimiter(sample) {
      const candidates = [",", "\t", ";"];
      let best = ",";
      let bestScore = -1;

      for (const d of candidates) {
        let inQuotes = false;
        let count = 0;
        for (let i = 0; i < sample.length; i++) {
          const ch = sample[i];
          if (ch === '"') {
            // Handle escaped quote ""
            if (inQuotes && sample[i + 1] === '"') {
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (!inQuotes && ch === d) {
            count++;
          }
        }
        if (count > bestScore) {
          bestScore = count;
          best = d;
        }
      }

      return best;
    }

    // Use first ~8k chars as delimiter sniff window
    const delimiter = sniffDelimiter(text.slice(0, 8000));

    // --- CSV parser (quote-aware, supports \n inside quotes) ---
    function parseCsv(text, delimiter) {
      const rows = [];
      let row = [];
      let cell = "";
      let inQuotes = false;

      // Normalize newlines
      const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (ch === '"') {
          if (inQuotes && s[i + 1] === '"') {
            // Escaped quote
            cell += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }

        if (!inQuotes && ch === delimiter) {
          row.push(cell);
          cell = "";
          continue;
        }

        if (!inQuotes && ch === "\n") {
          row.push(cell);
          cell = "";
          // Push row if it has any non-empty content
          if (row.some((c) => String(c || "").trim().length)) rows.push(row);
          row = [];
          continue;
        }

        cell += ch;
      }

      // Flush last cell/row
      row.push(cell);
      if (row.some((c) => String(c || "").trim().length)) rows.push(row);

      // Trim outer whitespace of each cell (but preserve internal whitespace)
      return rows.map((r) => r.map((c) => String(c ?? "").trim()));
    }

    const rows = parseCsv(text, delimiter);
    if (!rows.length) return [];

    const isUrlLike = (s) => {
      const v = String(s || "").trim();
      if (!v) return false;
      if (/^https?:\/\//i.test(v)) return true;
      if (/^www\./i.test(v)) return true;
      // domain-ish token without whitespace
      if (/[a-z0-9-]+\.[a-z]{2,}/i.test(v) && !/\s/.test(v)) return true;
      return false;
    };

    const looksLikeHeaderRow = (r0, r1) => {
      const r0HasUrl = (r0 || []).some(isUrlLike);
      const r1HasUrl = (r1 || []).some(isUrlLike);
      return !r0HasUrl && r1HasUrl;
    };

    // Header labels (lowercased)
    const header = (rows[0] || []).map((h) => String(h || "").toLowerCase());

    // Prefer explicit header labels first
    const preferredHeader = ["url", "link", "href", "website", "homepage"];
    let urlCol = -1;
    for (const key of preferredHeader) {
      const idx = header.findIndex((h) => h === key || h.includes(key));
      if (idx >= 0) {
        urlCol = idx;
        break;
      }
    }

    // If no header match, score columns by URL-likeness
    if (urlCol < 0) {
      const sampleCount = Math.min(rows.length, 12);
      let bestIdx = 0;
      let bestScore = -1;

      const colCount = Math.max(...rows.map((r) => r.length));
      for (let c = 0; c < colCount; c++) {
        let score = 0;
        for (let r = 1; r < sampleCount; r++) {
          if (isUrlLike(rows[r]?.[c])) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = c;
        }
      }

      urlCol = bestIdx;
    }

    const startRow = looksLikeHeaderRow(rows[0], rows[1]) ? 1 : 0;

    const urls = [];
    for (let r = startRow; r < rows.length; r++) {
      const val = rows[r]?.[urlCol];
      if (!isUrlLike(val)) continue;
      urls.push(val);
    }

    return urls;
  }

  // -------------------------
  // Routing (single vs batch)
  // -------------------------

  function routeImportedUrls(urls, sourceLabel) {
    const unique = normalizeAndDedupeUrls(urls);

    if (unique.length === 0) {
      App.ui.showToast(`${sourceLabel}: no valid URLs found.`, "error", 3200);
      return;
    }

    const replace = shouldReplaceOnImport();
    const type = App.ui.getSelectedType();
    const zipBaseName = (ctx.zipNameInputEl?.value || "links").trim() || "links";
    const currentMode = App.ui?.getMode ? App.ui.getMode() : "single";

    if (unique.length === 1 && currentMode !== "batch") {
      App.ui.setMode("single");
      App.state?.saveMode?.("single");
      if (ctx.urlInputEl) ctx.urlInputEl.value = unique[0];
      App.history?.recordSingle({
        url: unique[0],
        type,
        source: "import",
        label: sourceLabel,
      });

      if (typeof ctx.updatePreview === "function") ctx.updatePreview();
      App.ui.showToast(`Imported 1 link from ${sourceLabel}.`, "success", 2400);
      return;
    }

    // Batch mode: even a single imported URL goes to batch
    App.ui.setMode("batch");
    App.state?.saveMode?.("batch");
    if (typeof ctx.appendLinesToBatch === "function") {
      ctx.appendLinesToBatch(unique, { replace });
    } else if (ctx.batchInputEl) {
      ctx.batchInputEl.value = unique.join("\n");
    }

    App.history?.recordBatch({
      urls: unique,
      type,
      zipBaseName,
      source: "import",
      label: sourceLabel,
      replace,
    });

    ctx.batchInputEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    if (typeof ctx.updatePreview === "function") ctx.updatePreview();

    const modeWord = replace ? "Replaced" : "Appended";
    App.ui.showToast(`${modeWord} with ${unique.length} link(s) from ${sourceLabel}.`, "success", 2600);
  }

  function getUrlsFromBatchFileObj(batchObj) {
    const lines = batchObj?.input?.lines;
    if (!Array.isArray(lines)) return [];
    return normalizeAndDedupeUrls(lines);
  }

  // -------------------------
  // Main entry: importAnyFile(file)
  // -------------------------

  async function importAnyFile(file) {
    if (!file) return;

    const name = (file.name || "").toLowerCase();

    let text = "";
    try {
      text = await file.text();
    } catch (err) {
      if (App.errors?.show) App.errors.show(App.ui, "Could not read file", err);
      else App.ui.showToast("Could not read that file.", "error", 3200);
      return;
    }

    // .url
    if (name.endsWith(".url") || file.type === "application/internet-shortcut") {
      const u = extractUrlFromWindowsUrlFile(text);
      if (u) return routeImportedUrls([u], ".url shortcut");
      return App.ui.showToast("That .url file did not contain a readable URL= entry.", "error", 3200);
    }

    // .webloc (plist)
    if (name.endsWith(".webloc") || (file.type || "").includes("xml") || /<plist[\s>]/i.test(text)) {
      if (name.endsWith(".webloc") || /<plist[\s>]/i.test(text)) {
        const u = extractUrlFromWeblocFile(text);
        if (u) return routeImportedUrls([u], ".webloc file");
        if (name.endsWith(".webloc")) {
          return App.ui.showToast("That .webloc file did not contain a readable URL.", "error", 3200);
        }
      }
    }

    // HTML (redirect files OR bookmarks export)
    if (name.endsWith(".html") || name.endsWith(".htm") || looksLikeHtml(text)) {
      const urls = extractUrlsFromHtmlFile(text);
      if (urls.length) return routeImportedUrls(urls, "HTML file");
      return App.ui.showToast("HTML imported, but no link was found (not a recognized link file).", "error", 3200);
    }

    // JSON (batch file, firefox bookmarks json, export array, url list)
    if (name.endsWith(".json") || (file.type || "").includes("json")) {
      try {
        const parsed = App.importJson.parse(text, { 
          isValidBatchFileObject: ctx.isValidBatchFileObject || App.batchFile.isValidBatchFileObject,
        });

        if (parsed.kind === "batch") {
          const replace = shouldReplaceOnImport();

          // If we're appending, treat the batch file as a URL source and merge into batch input.
          if (!replace) {
            const urls = getUrlsFromBatchFileObj(parsed.batchObj);

            if (!urls.length) {
              App.ui.showToast("Batch file imported, but contained no valid URLs.", "error", 3200);
              return;
            }

            App.ui.setMode("batch");
            App.state?.saveMode?.("batch");

            if (typeof ctx.appendLinesToBatch === "function") {
              ctx.appendLinesToBatch(urls, { replace: false });
            } else if (ctx.batchInputEl) {
              const existing = String(ctx.batchInputEl.value || "").trim();
              ctx.batchInputEl.value = existing ? (existing + "\n" + urls.join("\n")) : urls.join("\n");
            }

            // record history (append)
            const type = parsed.batchObj?.outputType || App.ui.getSelectedType();
            const zipBaseName = (parsed.batchObj?.zipBaseName || "links").trim() || "links";

            App.history?.recordBatch({
              urls,
              type,
              zipBaseName,
              source: "import",
              label: "Batch File",
              replace: false,
              importedKind: "batchfile",
            });

            ctx.batchInputEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
            ctx.updatePreview?.();
            App.ui.showToast(`Appended ${urls.length} link(s) from Batch File.`, "success", 2600);
            return;
          }

          // Replace behavior: apply full UI state from the file
          if (typeof ctx.applyBatchFileToUI === "function") {
            ctx.applyBatchFileToUI(parsed.batchObj);

            // record history (replace)
            const urls = getUrlsFromBatchFileObj(parsed.batchObj);
            const type = parsed.batchObj?.outputType || App.ui.getSelectedType();
            const zipBaseName = (parsed.batchObj?.zipBaseName || "links").trim() || "links";

            App.history?.recordBatch({
              urls,
              type,
              zipBaseName,
              source: "import",
              label: "Batch File",
              replace: true,
              importedKind: "batchfile",
            });

            ctx.updatePreview?.();
            App.ui.showToast(`Imported batch file (${urls.length} link(s)).`, "success", 2400);
            return;
          }

          App.ui.showToast("Batch file detected, but applyBatchFileToUI is not wired.", "error", 3200);
          return;
        }

        if (parsed.kind === "urls") {
          return routeImportedUrls(parsed.urls, "JSON file");
        }
        return App.ui.showToast(
          `JSON imported, but format was not recognized (${parsed.kind || "unknown"}).`,
          "error",
          3200
        );
      } catch (err) {
        if (App.errors?.show) {
          App.errors.show(App.ui, "JSON import failed", err);
        } else {
          console.error(err);
          App.ui.showToast("JSON import failed (see console).", "error", 3200);
        }
        return;
      }
    }

    // CSV
    if (name.endsWith(".csv") || (file.type || "").includes("csv")) {
      let urls = [];
      try {
        urls = parseCsvForUrls(text);
      } catch (err) {
        if (App.errors?.show) App.errors.show(App.ui, "CSV import failed", err);
        else App.ui.showToast("CSV import failed.", "error", 3200);
        return;
      }
      if (urls.length === 0) {
        return App.ui.showToast("CSV imported, but no URLs were found.", "error", 3200);
      }
      return routeImportedUrls(urls, "CSV file");
    }

    // TXT
    if (name.endsWith(".txt") || (file.type || "").startsWith("text/")) {
      const urls = App.batch.parseBatchText(text);
      if (urls.length === 0) {
        return App.ui.showToast("Text file imported, but no URLs were found.", "error", 3200);
      }
      return routeImportedUrls(urls, "text file");
    }

    return App.ui.showToast("Unsupported file type. Try .json, .csv, .txt, .url, .webloc, or .html.", "error", 3200);
  }

  window.App.importFiles = {
    init,
    importAnyFile,
    // exported for testing/debugging if you want:
    routeImportedUrls,
  };
})();
