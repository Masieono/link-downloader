// lib/state.js
(function () {
  window.App = window.App || {};

  // All app storage keys live here (single source of truth)
  const KEYS = {
    // core
    mode: "lfg_mode_v1",
    selectedType: "lfg_selected_type_v1",
    urlMode: "lfg_url_mode_v1",

    // inputs
    singleUrl: "lfg_single_url_v1",
    singleFileName: "lfg_single_filename_v1",
    batchText: "lfg_batch_text_v1",
    zipName: "lfg_zip_name_v1",

    // export schema
    exportFields: "lfg_export_fields_v1",

    // batch options
    optDedupe: "lfg_opt_dedupe_v1",
    optExportCsv: "lfg_opt_export_csv_v1",
    optExportJson: "lfg_opt_export_json_v1",
    optImportAppend: "lfg_opt_import_append_v1",

    batchOptionsOpen: "lfg_batch_options_open_v1",

    // batch QR toggles
    optQrPng: "lfg_opt_qr_png_v1",
    optQrSvg: "lfg_opt_qr_svg_v1",

    QR_DETAILS_OPEN_KEY: "lfg_qr_details_open_v1",

    // QR render settings
    qrFg: "lfg_qr_fg_v1",
    qrBg: "lfg_qr_bg_v1",
    qrTransparent: "lfg_qr_transparent_v1",
    qrMargin: "lfg_qr_margin_v1",
    qrSize: "lfg_qr_size_v1",
    qrEcc: "lfg_qr_ecc_v1",
  };

  let ctx = {
    ui: null,               // App.ui
    updatePreview: null,    // function

    // Inputs
    urlInputEl: null,
    batchInputEl: null,
    zipNameInputEl: null,
    fileNameInputEl: null,

    // Options
    optDedupeEl: null,
    optExportCsvEl: null,
    optExportJsonEl: null,
    optImportAppendEl: null,
    optQrPngEl: null,
    optQrSvgEl: null,

    // QR
    qrFgEl: null,
    qrBgEl: null,
    qrTransparentEl: null,
    qrMarginEl: null,
    qrSizeEl: null,
    qrEccEl: null,

    // Export schema UI (DOM)
    exportFieldsSelectedEl: null,

    // Optional hook: let the export-schema module apply fields in its own way
    // e.g. applyExportFields: (fields) => App.exportSchema.setFields(fields)
    applyExportFields: null,
  };

  // -------------------------
  // localStorage helpers
  // -------------------------
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(key, String(value ?? "")); } catch {}
  }

  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function lsGetBool(key) {
    const raw = lsGet(key);
    if (raw == null) return null;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return null;
  }

  function lsSetBool(key, value) {
    lsSet(key, value ? "1" : "0");
  }

  function lsGetJson(key) {
    try {
      const raw = lsGet(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function lsSetJson(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
  }

  function loadBatchOptionsOpen() {
    const v = lsGet(KEYS.batchOptionsOpen);
    return v === "1";
  }

  function saveBatchOptionsOpen(isOpen) {
    lsSet(KEYS.batchOptionsOpen, isOpen ? "1" : "0");
  }

  // -------------------------
  // restore helpers (DOM setters)
  // -------------------------
  function setIfEl(el, value) {
    if (!el) return;
    el.value = value;
  }

  function checkIfEl(el, value) {
    if (!el) return;
    el.checked = !!value;
  }

  // -------------------------
  // MODE
  // -------------------------
  function saveMode(mode) {
    if (mode !== "single" && mode !== "batch") return;
    lsSet(KEYS.mode, mode);
  }

  function restoreMode() {
    const mode = lsGet(KEYS.mode);
    if (!mode) return;
    ctx.ui?.setMode?.(mode);
  }

  // -------------------------
  // FILE TYPE
  // -------------------------
  function saveSelectedType(type) {
    const t = String(type || "");
    if (!t) return;
    lsSet(KEYS.selectedType, t);
  }

  function restoreSelectedType() {
    const t = lsGet(KEYS.selectedType);
    if (!t) return;
    if (ctx.ui?.setSelectedType) ctx.ui.setSelectedType(t);
    else {
      const r = document.querySelector(`input[name="fileType"][value="${t}"]`);
      if (r) r.checked = true;
    }
    ctx.ui?.updateTypeSelectionUI?.();
  }

  // -------------------------
  // URL MODE
  // -------------------------
  function saveUrlMode(mode) {
    lsSet(KEYS.urlMode, String(mode || "full"));
  }

  function restoreUrlMode() {
    const m = lsGet(KEYS.urlMode);
    if (m && ctx.ui?.setUrlMode) ctx.ui.setUrlMode(m);
  }

  // -------------------------
  // TEXT INPUTS
  // -------------------------
  function saveZipName(value) {
    const v = typeof value === "string" ? value : (ctx.zipNameInputEl?.value ?? "");
    lsSet(KEYS.zipName, v);
  }

  function restoreZipName() {
    const v = lsGet(KEYS.zipName);
    if (v == null) return;
    setIfEl(ctx.zipNameInputEl, v);
  }

  function saveSingleFileName(value) {
    const v = typeof value === "string" ? value : (ctx.fileNameInputEl?.value ?? "");
    lsSet(KEYS.singleFileName, v);
  }

  function restoreSingleFileName() {
    const v = lsGet(KEYS.singleFileName);
    if (v == null) return;
    setIfEl(ctx.fileNameInputEl, v);
  }

  function saveSingleUrl(value) {
    const v = typeof value === "string" ? value : (ctx.urlInputEl?.value ?? "");
    lsSet(KEYS.singleUrl, v);
  }

  function restoreSingleUrl() {
    const v = lsGet(KEYS.singleUrl);
    if (v == null) return;
    setIfEl(ctx.urlInputEl, v);
  }

  function saveBatchText(value) {
    const v = typeof value === "string" ? value : (ctx.batchInputEl?.value ?? "");
    lsSet(KEYS.batchText, v);
  }

  function restoreBatchText() {
    const v = lsGet(KEYS.batchText);
    if (v == null) return;
    setIfEl(ctx.batchInputEl, v);
  }

  // -------------------------
  // OPTIONS (checkboxes)
  // -------------------------
  function saveOptions() {
    if (ctx.optDedupeEl) lsSetBool(KEYS.optDedupe, !!ctx.optDedupeEl.checked);
    if (ctx.optExportCsvEl) lsSetBool(KEYS.optExportCsv, !!ctx.optExportCsvEl.checked);
    if (ctx.optExportJsonEl) lsSetBool(KEYS.optExportJson, !!ctx.optExportJsonEl.checked);
    if (ctx.optImportAppendEl) lsSetBool(KEYS.optImportAppend, !!ctx.optImportAppendEl.checked);
    if (ctx.optQrPngEl) lsSetBool(KEYS.optQrPng, !!ctx.optQrPngEl.checked);
    if (ctx.optQrSvgEl) lsSetBool(KEYS.optQrSvg, !!ctx.optQrSvgEl.checked);
  }

  function restoreOptions() {
    const stored = {
      dedupe: lsGetBool(KEYS.optDedupe),
      exportCsv: lsGetBool(KEYS.optExportCsv),
      exportJson: lsGetBool(KEYS.optExportJson),
      importAppend: lsGetBool(KEYS.optImportAppend),
      qrPng: lsGetBool(KEYS.optQrPng),
      qrSvg: lsGetBool(KEYS.optQrSvg),
    };

    const DEFAULTS = {
      dedupe: false,
      exportCsv: true,
      exportJson: true,
      importAppend: true,
      qrPng: false,
      qrSvg: false,
    };

    checkIfEl(ctx.optDedupeEl, stored.dedupe != null ? stored.dedupe : DEFAULTS.dedupe);
    checkIfEl(ctx.optExportCsvEl, stored.exportCsv != null ? stored.exportCsv : DEFAULTS.exportCsv);
    checkIfEl(ctx.optExportJsonEl, stored.exportJson != null ? stored.exportJson : DEFAULTS.exportJson);
    checkIfEl(ctx.optImportAppendEl, stored.importAppend != null ? stored.importAppend : DEFAULTS.importAppend);
    checkIfEl(ctx.optQrPngEl, stored.qrPng != null ? stored.qrPng : DEFAULTS.qrPng);
    checkIfEl(ctx.optQrSvgEl, stored.qrSvg != null ? stored.qrSvg : DEFAULTS.qrSvg);
  }

  // -------------------------
  // QR SETTINGS
  // -------------------------
  function saveQrSettings() {
    if (ctx.qrFgEl) lsSet(KEYS.qrFg, ctx.qrFgEl.value || "#000000");
    if (ctx.qrBgEl) lsSet(KEYS.qrBg, ctx.qrBgEl.value || "#ffffff");
    if (ctx.qrTransparentEl) lsSetBool(KEYS.qrTransparent, !!ctx.qrTransparentEl.checked);
    if (ctx.qrMarginEl) lsSet(KEYS.qrMargin, String(ctx.qrMarginEl.value ?? "4"));
    if (ctx.qrSizeEl) lsSet(KEYS.qrSize, String(ctx.qrSizeEl.value || "medium"));
    if (ctx.qrEccEl) lsSet(KEYS.qrEcc, String(ctx.qrEccEl.value || "M"));
  }

  function restoreQrSettings() {
    const fg = lsGet(KEYS.qrFg);
    const bg = lsGet(KEYS.qrBg);
    const tr = lsGetBool(KEYS.qrTransparent);
    const margin = lsGet(KEYS.qrMargin);
    const size = lsGet(KEYS.qrSize);
    const ecc = lsGet(KEYS.qrEcc);

    if (fg) setIfEl(ctx.qrFgEl, fg);
    if (bg) setIfEl(ctx.qrBgEl, bg);
    if (tr != null) checkIfEl(ctx.qrTransparentEl, tr);
    if (margin != null) setIfEl(ctx.qrMarginEl, margin);
    if (size) setIfEl(ctx.qrSizeEl, size);
    if (ecc) setIfEl(ctx.qrEccEl, ecc);
  }

  const QR_DETAILS_OPEN_KEY = "lfg_qr_details_open_v1";

  function loadQrDetailsOpen() {
    try { return localStorage.getItem(QR_DETAILS_OPEN_KEY) === "1"; }
    catch { return false; }
  }

  function saveQrDetailsOpen(isOpen) {
    try { localStorage.setItem(QR_DETAILS_OPEN_KEY, isOpen ? "1" : "0"); }
    catch {}
  }

  function clearQrDetailsOpen() {
    try { localStorage.removeItem(QR_DETAILS_OPEN_KEY); }
    catch {}
  }

  // -------------------------
  // EXPORT SCHEMA
  // -------------------------
  function readExportFieldsFromDom() {
    const sel = ctx.exportFieldsSelectedEl;
    if (!sel) return [];
    return Array.from(sel.querySelectorAll("[data-field]"))
      .map((el) => el.getAttribute("data-field") || el.dataset.field || "")
      .map((s) => String(s).trim())
      .filter(Boolean);
  }

  function saveExportFields(fields) {
    const list = Array.isArray(fields) ? fields : readExportFieldsFromDom();
    if (!list || list.length === 0) return;
    lsSetJson(KEYS.exportFields, list);
  }

  function restoreExportFields() {
    const stored = lsGetJson(KEYS.exportFields);
    if (!Array.isArray(stored) || stored.length === 0) return;

    if (typeof ctx.applyExportFields === "function") {
      ctx.applyExportFields(stored);
      return;
    }

    // DOM fallback: reorder selected items to match stored order
    const sel = ctx.exportFieldsSelectedEl;
    if (!sel) return;

    const children = Array.from(sel.children);
    const byField = new Map();
    for (const el of children) {
      const f = el.getAttribute("data-field") || el.dataset.field;
      if (f) byField.set(String(f), el);
    }

    const desired = [];
    for (const f of stored) {
      const node = byField.get(String(f));
      if (node) desired.push(node);
    }
    for (const el of children) {
      if (!desired.includes(el)) desired.push(el);
    }

    desired.forEach((node) => sel.appendChild(node));
  }

  // -------------------------
  // WIRING
  // -------------------------
  function wire() {
    // mode
    document.querySelectorAll('input[name="mode"]').forEach((r) => {
      r.addEventListener("change", () => saveMode(r.value));
    });

    // file type
    document.querySelectorAll('input[name="fileType"]').forEach((r) => {
      r.addEventListener("change", () => saveSelectedType(r.value));
    });

    // url mode
    document.querySelectorAll('input[name="urlMode"]').forEach((r) => {
      r.addEventListener("change", () => {
        if (ctx.ui?.getUrlMode) saveUrlMode(ctx.ui.getUrlMode());
      });
    });

    // inputs
    ctx.zipNameInputEl?.addEventListener("input", saveZipName);
    ctx.fileNameInputEl?.addEventListener("input", saveSingleFileName);
    ctx.urlInputEl?.addEventListener("input", saveSingleUrl);
    ctx.batchInputEl?.addEventListener("input", saveBatchText);

    // options
    [
      ctx.optDedupeEl,
      ctx.optExportCsvEl,
      ctx.optExportJsonEl,
      ctx.optImportAppendEl,
      ctx.optQrPngEl,
      ctx.optQrSvgEl,
    ].forEach((el) => el?.addEventListener("change", saveOptions));

    // QR settings
    [
      ctx.qrFgEl,
      ctx.qrBgEl,
      ctx.qrTransparentEl,
      ctx.qrMarginEl,
      ctx.qrSizeEl,
      ctx.qrEccEl,
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", saveQrSettings);
      el.addEventListener("change", saveQrSettings);
    });

    // export schema: watch selected list for reorder/add/remove
    if (ctx.exportFieldsSelectedEl) {
      const obs = new MutationObserver(() => saveExportFields());
      obs.observe(ctx.exportFieldsSelectedEl, { childList: true });
    }
  }

  // -------------------------
  // INIT + CLEAR
  // -------------------------
  function init(c) {
    ctx = { ...ctx, ...(c || {}) };

    // Restore order matters:
    // 1) options + modes that affect layout/behavior
    restoreOptions();
    restoreSelectedType();
    restoreUrlMode();
    restoreExportFields();

    // 2) text values
    restoreZipName();
    restoreSingleFileName();
    restoreSingleUrl();
    restoreBatchText();

    // 3) QR settings
    restoreQrSettings();

    // 4) mode last (so correct panel shows)
    restoreMode();

    wire();

    ctx.updatePreview?.();
  }

  function clearAllAppState() {
    Object.values(KEYS).forEach(lsRemove);
  }

  function clearAllOriginStorage() {
    try { localStorage.clear(); } catch {}
  }

  window.App.state = {
    init,

    // exposed
    saveMode,
    saveSelectedType,
    saveUrlMode,
    saveZipName,
    saveSingleFileName,
    saveSingleUrl,
    saveBatchText,
    saveOptions,
    clearAllAppState,
    clearAllOriginStorage,
    loadBatchOptionsOpen,
    saveBatchOptionsOpen,

    loadQrDetailsOpen,
    saveQrDetailsOpen,
    clearQrDetailsOpen,
  };
})();