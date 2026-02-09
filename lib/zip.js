// lib/zip.js
(function () {
  window.App = window.App || {};

  // ---------------------------------------------------------------------------
  // ZIP builder
  // - Generates link files from URLs
  // - Optionally adds export.csv / export.json
  // - Optionally adds QR codes (PNG/SVG) under qr/
  // - Adds a manifest.json describing what was produced
  // ---------------------------------------------------------------------------

  function assertJsZipLoaded() {
    if (typeof JSZip === "undefined") {
      throw new Error(
        'JSZip is not loaded. Ensure "./vendor/jszip.min.js" is included before app.js.'
      );
    }
  }

  function assertDeps(deps) {
    const url = deps?.url;
    const outputBuilders = deps?.outputBuilders;
    const exporter = deps?.exporter;

    if (!url || !outputBuilders || !exporter) {
      throw new Error("ZIP builder missing dependencies (url/outputBuilders/exporter).");
    }

    return { url, outputBuilders, exporter };
  }

  function defaultQrRender() {
    return {
      foreground: "#000000",
      background: "#ffffff",
      transparent: false,
      margin: 4,
      scale: 8,
      ecc: "M",
    };
  }

  // Makes a safe base for QR filenames derived from the link filename
  function sanitizeBaseNameForFile(raw) {
    return String(raw || "")
      .replace(/[^a-z0-9._-]/gi, "_")
      .replace(/_+/g, "_")
      .slice(0, 200);
  }

  function makeUniqueBase(base, used) {
    const b = String(base || "link").slice(0, 200);
    if (!used.has(b)) {
      used.add(b);
      return b;
    }
    let i = 2;
    while (used.has(`${b}-${i}`)) i++;
    const out = `${b}-${i}`;
    used.add(out);
    return out;
  }

  async function buildZipFromUrls(urlItems, type, zipBaseName, options, deps) {
    assertJsZipLoaded();
    const { url, outputBuilders, exporter } = assertDeps(deps);

    const zip = new JSZip();

    // Tracks only the primary "link files" we generate from URLs.
    const usedLinkNames = new Set();

    // Used for exports + QR generation, after final ZIP filenames are known.
    // [{ raw, url, normalizedUrl, _zipFilename }]
    const itemsWithZipNames = [];

    const ext = url.getExtensionForType(type);
    const extNoDot = String(ext || "").replace(/^\./, "");

    // -------------------------
    // 1) Main link files
    // -------------------------
    for (const item of urlItems || []) {
      const out = outputBuilders.buildFileContents(item?.url, type);
      if (!out) continue;

      // Base name from URL → ensure safe → ensure extension → ensure uniqueness
      const derivedBase = url.safeBaseNameFromUrl(item.url);
      const safe = url.ensureSafeFilename(derivedBase, ext);
      const fileName = url.makeUniqueFilename(safe, usedLinkNames);

      zip.file(fileName, out.contents);

      itemsWithZipNames.push({
        raw: item.raw,
        url: item.url, // effective URL
        normalizedUrl: item.normalizedUrl || item.url,
        _zipFilename: fileName,
      });
    }

    // -------------------------
    // 2) Export rows (CSV/JSON)
    // -------------------------
    // Build rows once, after ZIP filenames are final so we can force "filename".
    const planLike = {
      type,
      deduped: itemsWithZipNames.map(({ raw, url, normalizedUrl }) => ({
        raw,
        url,
        effectiveUrl: url,
        normalizedUrl,
      })),
    };

    const exportRows = exporter.buildExportRowsForBatch(planLike, { url });

    // Force exact zip filenames onto export rows (defensive: cap to min length)
    const n = Math.min(exportRows.length, itemsWithZipNames.length);
    for (let i = 0; i < n; i++) {
      exportRows[i].filename =
        itemsWithZipNames[i]?._zipFilename || exportRows[i].filename;
    }

    // -------------------------
    // 3) QR add-ons (PNG/SVG)
    // -------------------------
    const wantQrPng = !!options?.qrPng;
    const wantQrSvg = !!options?.qrSvg;

    if (wantQrPng || wantQrSvg) {
      if (!window.App?.qr?.buildBatchQrFiles) {
        throw new Error(
          "QR requested, but App.qr.buildBatchQrFiles is not available. Check script includes/order for qr.js."
        );
      }

      const itemsForQr = itemsWithZipNames.map((it, idx) => ({
        url: it.url,
        _zipFilename: it._zipFilename || `link_${idx + 1}.${ext}`,
      }));

      if (itemsForQr.length === 0) {
        throw new Error("QR requested, but there were no ZIP items to generate QR codes for.");
      }

      const render = options?.qrRender || defaultQrRender();

      const usedQrBases = new Set();

      let qrFiles = [];
      try {
        qrFiles = await App.qr.buildBatchQrFiles(itemsForQr, {
          includePng: wantQrPng,
          includeSvg: wantQrSvg,
          folder: "qr/",
          filenameFrom: (item, idx) => {
            const fn = item?._zipFilename || `link_${idx + 1}.${ext}`;
            const dot = fn.lastIndexOf(".");
            const base = dot > 0 ? fn.slice(0, dot) : fn;
            const cleaned = sanitizeBaseNameForFile(base);
            return makeUniqueBase(cleaned || `link_${idx + 1}`, usedQrBases);
          },

          // preferred: render object
          render,

          // compatibility
          margin: render.margin ?? 4,
          scale: render.scale ?? 8,
          ecc: render.ecc ?? "M",
        });
      } catch (e) {
        console.error("QR generation failed:", e);
        throw new Error(e?.message || "QR generation failed (see console).");
      }

      if (!Array.isArray(qrFiles) || qrFiles.length === 0) {
        const sample = itemsForQr[0]?.url || "";
        throw new Error(
          `QR requested, but no QR files were generated. Sample URL: ${sample}`
        );
      }

      for (const f of qrFiles) {
        if (!f?.name) continue;
        if (f.type === "blob") zip.file(f.name, f.blobOrText);
        else zip.file(f.name, String(f.blobOrText || ""));
      }
    }

    // -------------------------
    // 4) Manifest + exports
    // -------------------------
    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          version: 1,
          createdAt: new Date().toISOString(),
          outputType: type,

          // Be explicit: this is the count of primary URL-derived files
          linkFileCount: usedLinkNames.size,

          exports: {
            csv: !!options?.exportCsv,
            json: !!options?.exportJson,
            qrPng: wantQrPng,
            qrSvg: wantQrSvg,
          },

          options: options || {},
        },
        null,
        2
      ) + "\n"
    );

    if (options?.exportCsv) {
      zip.file("export.csv", exporter.buildCsvExport(exportRows, options?.exportFields));
    }
    if (options?.exportJson) {
      zip.file("export.json", exporter.buildJsonExport(exportRows, options?.exportFields));
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = url.ensureExtension(zipBaseName || "links", "zip");

    return { blob, zipName, fileCount: usedLinkNames.size, exportRows };
  }

  window.App.zip = { buildZipFromUrls };
})();
