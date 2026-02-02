// lib/batch-file.js
(function () {
  window.App = window.App || {};

  const BATCH_KIND = "link-file-generator-batch";
  const BATCH_VERSION = 1;

  function buildBatchFileObject(plan) {
    const options = plan?.options && typeof plan.options === "object" ? plan.options : {};

    return {
      version: BATCH_VERSION,
      kind: BATCH_KIND,
      createdAt: new Date().toISOString(),

      // Persist options used to build the plan (dedupe/export/qr/schema/etc)
      options,

      outputType: plan?.type || "html",
      zipBaseName: plan?.zipBaseName || "links",

      input: {
        // Preserve original lines (including duplicates) for rehydration later
        lines: Array.isArray(plan?.lines) ? plan.lines : [],
      },
    };
  }

  function buildBatchFileJson(plan) {
    return JSON.stringify(buildBatchFileObject(plan), null, 2) + "\n";
  }

  function isValidBatchFileObject(obj) {
    return (
      obj &&
      typeof obj === "object" &&
      obj.kind === BATCH_KIND &&
      obj.version === BATCH_VERSION &&
      obj.input &&
      Array.isArray(obj.input.lines)
    );
  }

  /*
   * Apply a batch file object to the UI.
   * This is UI-aware by design (because it's literally "restore a session").
   *
   * ctx expected (all optional):
   * - setMode("batch")
   * - batchInputEl, zipNameInputEl
   * - setSelectedType(type)
   * - optDedupeEl, optExportCsvEl, optExportJsonEl, optQrPngEl, optQrSvgEl
   * - dedupeModeEl (select)
   * - applyExportFields(fields)  <-- recommended (ties into App.exportSchema)
   * - updatePreview(), showToast()
   */
  function applyBatchFileToUI(obj, ctx = {}) {
    if (!isValidBatchFileObject(obj)) {
      ctx?.showToast?.("Invalid batch file.", "error", 2600);
      return false;
    }

    // Switch to batch mode
    ctx?.setMode?.("batch");

    // Load lines into textarea
    if (ctx?.batchInputEl) ctx.batchInputEl.value = obj.input.lines.join("\n");

    // Zip base name
    if (ctx?.zipNameInputEl && typeof obj.zipBaseName === "string") {
      ctx.zipNameInputEl.value = obj.zipBaseName;
    }

    // Output type
    if (typeof obj.outputType === "string") {
      ctx?.setSelectedType?.(obj.outputType);
    }

    const opt = obj.options && typeof obj.options === "object" ? obj.options : {};

    // Options: checkboxes
    if (ctx?.optDedupeEl && typeof opt.dedupe === "boolean") ctx.optDedupeEl.checked = opt.dedupe;
    if (ctx?.optExportCsvEl && typeof opt.exportCsv === "boolean") ctx.optExportCsvEl.checked = opt.exportCsv;
    if (ctx?.optExportJsonEl && typeof opt.exportJson === "boolean") ctx.optExportJsonEl.checked = opt.exportJson;

    // Options: dedupe mode (select)
    if (ctx?.dedupeModeEl && typeof opt.dedupeMode === "string") {
      ctx.dedupeModeEl.value = opt.dedupeMode;
    }

    // Options: export schema fields (preferred path)
    if (typeof ctx?.applyExportFields === "function" && Array.isArray(opt.exportFields)) {
      ctx.applyExportFields(opt.exportFields);
    }

    // Options: QR toggles
    if (ctx?.optQrPngEl && typeof opt.qrPng === "boolean") ctx.optQrPngEl.checked = opt.qrPng;
    if (ctx?.optQrSvgEl && typeof opt.qrSvg === "boolean") ctx.optQrSvgEl.checked = opt.qrSvg;

    ctx?.updatePreview?.();
    ctx?.showToast?.("Batch file imported.", "success", 2200);
    return true;
  }

  window.App.batchFile = {
    buildBatchFileObject,
    buildBatchFileJson,
    isValidBatchFileObject,
    applyBatchFileToUI,
  };
})();
