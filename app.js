// -------------------------
// DOM
// -------------------------

// Theme
const themeToggleBtn = document.getElementById("themeToggleBtn");

// Single mode
const urlInput = document.getElementById("urlInput");
const fileNameInput = document.getElementById("fileName");
const statusEl = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const dropZone = document.getElementById("dropZone");

// Import
const chooseImportBtn = document.getElementById("chooseImportBtn");
const importAnyFileInput = document.getElementById("importAnyFileInput");

// Panels / mode
const singlePanel = document.getElementById("singlePanel");
const batchPanel = document.getElementById("batchPanel");

// Batch mode 
const batchInput = document.getElementById("batchInput");
const zipNameInput = document.getElementById("zipName");
const dedupeModeEl = document.getElementById("dedupeMode");

const downloadZipBtn = document.getElementById("downloadZipBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const downloadBatchFileBtn = document.getElementById("downloadBatchFileBtn");

/*
const copyBatchSelect = document.getElementById("copyBatchSelect");
const copyBatchBtn = document.getElementById("copyBatchBtn");
*/

const copyBatchCsvBtn = document.getElementById("copyBatchCsvBtn");
const copyBatchJsonBtn = document.getElementById("copyBatchJsonBtn");
const copyBatchUrlsBtn = document.getElementById("copyBatchUrlsBtn");

const openNowBtn = document.getElementById("openNowBtn");
const openFirstBtn = document.getElementById("openFirstBtn");

// Batch options
const optImportAppend = document.getElementById("optImportAppend");
const optDedupe = document.getElementById("optDedupe");
const optExportCsv = document.getElementById("optExportCsv");
const optExportJson = document.getElementById("optExportJson");

const optQrPng = document.getElementById("optQrPng");
const optQrSvg = document.getElementById("optQrSvg");

// Batch QR options (mirrors single QR settings)
const batchQrOptionsEl = document.getElementById("batchQrOptions");
const qrFgBatch = document.getElementById("qrFgBatch");
const qrBgBatch = document.getElementById("qrBgBatch");
const qrTransparentBatch = document.getElementById("qrTransparentBatch");
const qrMarginBatch = document.getElementById("qrMarginBatch");
const qrSizeBatch = document.getElementById("qrSizeBatch");
const qrEccBatch = document.getElementById("qrEccBatch");

const batchOptionsDetailsEl = document.getElementById("batchOptionsDetails");

// Export Schema UI
const exportFieldsSelected = document.getElementById("exportFieldsSelected");
const exportFieldsAvailable = document.getElementById("exportFieldsAvailable");

// Reset
const resetBtn = document.getElementById("resetBtn");
const resetBtnBatch = document.getElementById("resetBtnBatch");
const factoryResetBtn = document.getElementById("factoryResetBtn");

// Invalid panel
const invalidPanel = document.getElementById("invalidPanel");
const invalidCount = document.getElementById("invalidCount");
const toggleInvalidBtn = document.getElementById("toggleInvalidBtn");
const invalidBody = document.getElementById("invalidBody");
const invalidList = document.getElementById("invalidList");

// Dedupe strength UI
const dedupeStrengthWrap = document.getElementById("dedupeStrengthWrap");

// QR UI
// const showQrBtn = document.getElementById("showQrBtn");
const qrPanel = document.getElementById("qrPanel");

const qrImg = document.getElementById("qrImg");
const qrUrlLabel = document.getElementById("qrUrlLabel");
const qrCopyUrlBtn = document.getElementById("qrCopyUrlBtn");
const qrCopySvgBtn = document.getElementById("qrCopySvgBtn");
const qrDlPngBtn = document.getElementById("qrDlPngBtn");
const qrDlSvgBtn = document.getElementById("qrDlSvgBtn");

const qrWarn = document.getElementById("qrWarn");

const qrFg = document.getElementById("qrFg");
const qrBg = document.getElementById("qrBg");
const qrTransparent = document.getElementById("qrTransparent");
const qrMargin = document.getElementById("qrMargin");
const qrSize = document.getElementById("qrSize");
const qrEcc = document.getElementById("qrEcc");

// -------------------------
// Glue functions + helpers
// -------------------------

function refreshDedupeStrengthVisibility() {
  const on = !!optDedupe?.checked;
  if (dedupeStrengthWrap) dedupeStrengthWrap.hidden = !on;
}

function getBatchOptions() {
  // Source of truth for export fields is export-schema UI
  const exportFields = App.exportSchema?.getFields?.() || ["url"];

  // Safety: never allow empty schema
  const safeFields = Array.isArray(exportFields) && exportFields.length ? exportFields : ["url"];

  return {
    dedupe: optDedupe ? !!optDedupe.checked : true,
    dedupeMode: dedupeModeEl?.value || "exact",

    exportCsv: optExportCsv ? !!optExportCsv.checked : true,
    exportJson: optExportJson ? !!optExportJson.checked : true,
    exportFields: safeFields,

    qrPng: optQrPng ? !!optQrPng.checked : false,
    qrSvg: optQrSvg ? !!optQrSvg.checked : false,
  };
}

function buildBatchPlanFromUI() {
  const normalizeWithMode = (raw) => {
    const n = App.url.normalizeUrl(raw);
    if (!n.ok) return n;

    const effective = App.url.applyUrlMode(n.url, App.ui.getUrlMode());

    // IMPORTANT:
    // - url: effective URL (used by the app for actual actions)
    // - normalizedUrl: original normalized URL (for exports/history/debug)
    return { ok: true, url: effective, normalizedUrl: n.url };
  };

  return App.batch.buildPlanFromUI({
    batchInputEl: batchInput,
    zipNameInputEl: zipNameInput,
    getBatchOptions,
    normalizeUrl: normalizeWithMode,
    getSelectedType: App.ui.getSelectedType,
  });
}

function getDerivedFilename(urlStr, type) {
  const ext = App.url.getExtensionForType(type);

  let name = fileNameInput?.value?.trim() || "";
  if (!name) name = App.url.safeBaseNameFromUrl(urlStr);

  return App.url.ensureSafeFilename(name, ext);
}

function updatePreview() {
  // Defensive: support either App.ui helpers or direct DOM access
  const mode =
    (App?.ui?.getMode && App.ui.getMode()) ||
    document.querySelector('input[name="mode"]:checked')?.value ||
    "single";

  const type =
    (App?.ui?.getSelectedType && App.ui.getSelectedType()) ||
    document.querySelector('input[name="fileType"]:checked')?.value ||
    "html";

  const setStatus = (msg) => {
    if (App?.ui?.setPreviewStatus) App.ui.setPreviewStatus(msg);
    else if (typeof setPreviewStatus === "function") setPreviewStatus(msg); // legacy
    else if (statusEl) statusEl.textContent = msg || "";
  };

  // SINGLE MODE
  if (mode === "single") {
    const raw = urlInput?.value?.trim() || "";
    if (!raw) {
      setStatus("");
      renderInvalidList([]); // hide invalid panel in single mode
      return;
    }

    const norm = App.url.normalizeUrl(raw);
    if (!norm.ok) {
      setStatus("❌ " + norm.reason);
      renderInvalidList([]); // hide invalid panel in single mode
      return;
    }

    const effective = App.url.applyUrlMode(norm.url, App.ui.getUrlMode());
    const derived = getDerivedFilename(effective, type);
    setStatus(`Will download as: ${derived}\nEffective URL: ${effective}`);
    renderInvalidList([]); // hide invalid panel in single mode
    return;
  }

  // BATCH MODE
  const plan = buildBatchPlanFromUI();

  // If empty batch input: hide invalid panel and clear status
  if (!plan.lines || plan.lines.length === 0) {
    setStatus("");
    renderInvalidList([]); // <-- key change: don't show stale invalid items
    return;
  }

  // IMPORTANT: always update invalid list in batch mode
  renderInvalidList(plan.invalid);

  const exportBits = [
    plan.options?.exportCsv ? "CSV" : null,
    plan.options?.exportJson ? "JSON" : null,
  ].filter(Boolean);

  setStatus(
    `Batch parsed: ${plan.lines.length} line(s)\n` +
      `Valid: ${plan.valid.length}, Invalid: ${plan.invalid.length}\n` +
      (plan.options?.dedupe
        ? `Dedupe: ON (removed ${plan.removedCount}) → ${plan.deduped.length} unique\n`
        : `Dedupe: OFF\n`) +
      `Output type: .${App.url.getExtensionForType(type)}\n` +
      `ZIP name: ${App.url.ensureExtension(plan.zipBaseName, "zip")}\n` +
      `Exports in ZIP: ${exportBits.length ? exportBits.join(" + ") : "none"}`
  );
}

function appendLinesToBatch(lines, { replace = true } = {}) {
  const text = (lines || []).map((s) => String(s).trim()).filter(Boolean).join("\n");
  if (!batchInput) return;

  if (replace || !batchInput.value.trim()) {
    batchInput.value = text;
  } else {
    batchInput.value = batchInput.value.trimEnd() + "\n" + text;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInvalidList(invalidItems) {
  if (!invalidPanel || !invalidList || !invalidCount || !toggleInvalidBtn || !invalidBody) return;

  const invalid = Array.isArray(invalidItems) ? invalidItems : [];

  if (invalid.length === 0) {
    invalidPanel.hidden = true;
    invalidBody.hidden = true;
    toggleInvalidBtn.textContent = "Show";
    invalidList.innerHTML = "";
    invalidCount.textContent = "";
    return;
  }

  invalidPanel.hidden = false;
  invalidCount.textContent = `(${invalid.length})`;

  // Keep current expanded/collapsed state
  const isOpen = !invalidBody.hidden;

  toggleInvalidBtn.textContent = isOpen ? "Hide" : "Show";

  // Render list (limit to avoid huge DOM if someone pastes a ton of junk)
  const maxShow = 50;
  const shown = invalid.slice(0, maxShow);

  invalidList.innerHTML = shown
    .map(
      (it) => `
      <div class="invalid-item">
        <div class="invalid-reason"><strong>Reason:</strong> ${escapeHtml(it.reason || "Invalid URL")}</div>
        <div class="invalid-raw">${escapeHtml(it.raw || "")}</div>
      </div>
    `
    )
    .join("");

  if (invalid.length > maxShow) {
    invalidList.innerHTML += `<div class="hint">Showing first ${maxShow} invalid lines.</div>`;
  }
}

function setDragOver(el, on) {
  if (!el) return;
  el.classList.toggle("dragover", !!on);
}




function refreshBatchQrOptionsVisibility() {
  const show = !!(optQrPng?.checked || optQrSvg?.checked);
  if (batchQrOptionsEl) batchQrOptionsEl.hidden = !show;
}

// Sync helpers: batch controls mirror single QR controls (shared source of truth)
function syncValue(src, dst) {
  if (!src || !dst) return;
  dst.value = src.value;
}
function syncChecked(src, dst) {
  if (!src || !dst) return;
  dst.checked = !!src.checked;
}

function wireMirroredQrControls() {
  // initial copy: single -> batch
  syncValue(qrFg, qrFgBatch);
  syncValue(qrBg, qrBgBatch);
  syncChecked(qrTransparent, qrTransparentBatch);
  syncValue(qrMargin, qrMarginBatch);
  syncValue(qrSize, qrSizeBatch);
  syncValue(qrEcc, qrEccBatch);

  // prevent feedback loops
  let syncing = false;
  const guard = (fn) => () => {
    if (syncing) return;
    syncing = true;
    try { fn(); } finally { syncing = false; }
  };

  // batch -> single (this is what makes ZIP use the same render opts)
  qrFgBatch?.addEventListener("input", guard(() => { qrFg.value = qrFgBatch.value; actions.handleQrUiChanged?.("appearance"); }));
  qrBgBatch?.addEventListener("input", guard(() => { qrBg.value = qrBgBatch.value; actions.handleQrUiChanged?.("appearance"); }));
  qrTransparentBatch?.addEventListener("change", guard(() => { qrTransparent.checked = qrTransparentBatch.checked; actions.handleQrUiChanged?.("appearance"); }));
  qrMarginBatch?.addEventListener("input", guard(() => { qrMargin.value = qrMarginBatch.value; actions.handleQrUiChanged?.("tuning"); }));
  qrSizeBatch?.addEventListener("change", guard(() => { qrSize.value = qrSizeBatch.value; actions.handleQrUiChanged?.("tuning"); }));
  qrEccBatch?.addEventListener("change", guard(() => { qrEcc.value = qrEccBatch.value; actions.handleQrUiChanged?.("tuning"); }));

  // single -> batch (keep batch UI in sync if user edits in single QR panel)
  qrFg?.addEventListener("input", guard(() => syncValue(qrFg, qrFgBatch)));
  qrBg?.addEventListener("input", guard(() => syncValue(qrBg, qrBgBatch)));
  qrTransparent?.addEventListener("change", guard(() => syncChecked(qrTransparent, qrTransparentBatch)));
  qrMargin?.addEventListener("input", guard(() => syncValue(qrMargin, qrMarginBatch)));
  qrSize?.addEventListener("change", guard(() => syncValue(qrSize, qrSizeBatch)));
  qrEcc?.addEventListener("change", guard(() => syncValue(qrEcc, qrEccBatch)));
}







// -------------------------
// INIT
// -------------------------

// Import init (import-files.js)
App.importFiles.init({
  urlInputEl: urlInput,
  batchInputEl: batchInput,
  zipNameInputEl: zipNameInput,
  appendLinesToBatch,
  importAppendEl: optImportAppend,
  applyBatchFileToUI: (obj) =>
    App.batchFile.applyBatchFileToUI(obj, {
      setMode: App.ui.setMode,
      setSelectedType: App.ui.setSelectedType,
      showToast: App.ui.showToast,
      updatePreview,
      batchInputEl: batchInput,
      zipNameInputEl: zipNameInput,
      optDedupeEl: optDedupe,
      optExportCsvEl: optExportCsv,
      optExportJsonEl: optExportJson,
      dedupeModeEl: dedupeModeEl,
      optQrPngEl: optQrPng,
      optQrSvgEl: optQrSvg,
      applyExportFields: (fields) => App.exportSchema?.setFields?.(fields),
    }),
  isValidBatchFileObject: App.batchFile.isValidBatchFileObject,
  updatePreview,
});

// UI init (lib/ui.js)
App.ui.init({
  statusEl,
  singlePanel,
  batchPanel,
  updatePreview,
});

// State init (lib/state.js)
App.state.init({
  ui: App.ui,
  updatePreview,

  urlInputEl: urlInput,
  batchInputEl: batchInput,
  zipNameInputEl: zipNameInput,
  fileNameInputEl: fileNameInput,

  optDedupeEl: optDedupe,
  optExportCsvEl: optExportCsv,
  optExportJsonEl: optExportJson,
  optImportAppendEl: optImportAppend,
  optQrPngEl: optQrPng,
  optQrSvgEl: optQrSvg,

  exportFieldsSelectedEl: exportFieldsSelected,
  exportFieldsAvailableEl: exportFieldsAvailable,

  // QR
  qrFgEl: qrFg,
  qrBgEl: qrBg,
  qrTransparentEl: qrTransparent,
  qrMarginEl: qrMargin,
  qrSizeEl: qrSize,
  qrEccEl: qrEcc,

  applyExportFields: (fields) => App.exportSchema?.setFields?.(fields), // GPT recommended addition
});

// Export schema init
App.exportSchema.init({
  selectedListEl: exportFieldsSelected,
  availableListEl: exportFieldsAvailable,
  onChange: () => updatePreview(),
});

// URL mode persistence
App.state?.restoreUrlMode?.({ ui: App.ui, updatePreview });
App.state?.wireUrlModePersistence?.({ ui: App.ui, updatePreview });

// Theme init
App.theme.init({ toggleBtnEl: themeToggleBtn });

// Actions init (lib/actions.js)
const actions = App.actions.init({
  // Core inputs
  urlInputEl: urlInput,
  fileNameInputEl: fileNameInput,
  batchInputEl: batchInput,
  zipNameInputEl: zipNameInput,

  // Options
  optDedupeEl: optDedupe,
  optExportCsvEl: optExportCsv,
  optExportJsonEl: optExportJson,
  optImportAppendEl: optImportAppend,
  optQrPngEl: optQrPng,
  optQrSvgEl: optQrSvg,

  // Buttons / selects
  openFirstBtnEl: openFirstBtn,
  resetBtnEl: resetBtn,
  resetBtnBatchEl: resetBtnBatch,
  copyBtnEl: copyBtn,

  // Single-mode buttons
  downloadBtnEl: downloadBtn,
  openNowBtnEl: openNowBtn,
  resetBtnEl: resetBtn,
  copyBtnEl: copyBtn,

  downloadZipBtnEl: downloadZipBtn,
  downloadCsvBtnEl: downloadCsvBtn,
  downloadJsonBtnEl: downloadJsonBtn,
  downloadBatchFileBtnEl: downloadBatchFileBtn,

  copyBatchCsvBtnEl: copyBatchCsvBtn,
  copyBatchJsonBtnEl: copyBatchJsonBtn,
  copyBatchUrlsBtnEl: copyBatchUrlsBtn,

  // QR
  // showQrBtnEl: showQrBtn,
  qrPanelEl: qrPanel,
  qrImgEl: qrImg,
  qrUrlLabelEl: qrUrlLabel,
  qrWarnEl: qrWarn,

  qrFgEl: qrFg,
  qrBgEl: qrBg,
  qrTransparentEl: qrTransparent,
  qrMarginEl: qrMargin,
  qrSizeEl: qrSize,
  qrEccEl: qrEcc,

  qrCopyUrlBtnEl: qrCopyUrlBtn,
  qrCopySvgBtnEl: qrCopySvgBtn,
  qrDlPngBtnEl: qrDlPngBtn,
  qrDlSvgBtnEl: qrDlSvgBtn,

  factoryResetBtnEl: factoryResetBtn,

  // Required deps
  getDerivedFilename,
  buildBatchPlanFromUI,
  updatePreview,
  ui: App.ui,
});

// History init (lib/history.js)
App.history.init({
  historyListEl: document.getElementById("historyList"),
  clearBtnEl: document.getElementById("clearHistoryBtn"),
  historyCountEl: document.getElementById("historyCount"),
  detailsEl: document.getElementById("historyDetails"),

  setMode: App.ui.setMode,
  setSelectedType: App.ui.setSelectedType,

  setSingleUrl: (v) => {
    urlInput.value = v;
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));
  },
  setSingleFileName: (v) => {
    fileNameInput.value = v;
    fileNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  },
  setBatchText: (v) => {
    batchInput.value = v;
    batchInput.dispatchEvent(new Event("input", { bubbles: true }));
  },
  setZipName: (v) => {
    zipNameInput.value = v;
    zipNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  },

  updatePreview,
  showToast: App.ui.showToast,

  downloadSingleNow: actions.handleDownloadSingle,
  downloadZipNow: actions.handleDownloadZipBatch,
  downloadCsvNow: actions.handleDownloadCsvBatch,
  downloadJsonNow: actions.handleDownloadJsonBatch,
});

// Initialize UI state
App.ui.updateModeUI();
App.ui.updateTypeSelectionUI();
App.ui.updateDedupeModeUI?.();
updatePreview();
actions.updateQrSummaryText?.();
actions.refreshSingleActionsEnabled?.();
actions.refreshBatchCopyEnabled?.();
refreshDedupeStrengthVisibility();
actions.restoreQrPanelState?.();
refreshBatchQrOptionsVisibility();
wireMirroredQrControls();


// -------------------------
// EVENTS
// -------------------------

(function () {
  const el = document.getElementById("batchOptionsDetails");
  if (!el) return;

  el.open = App.state?.loadBatchOptionsOpen?.() === true;

  el.addEventListener("toggle", () => {
    App.state?.saveBatchOptionsOpen?.(!!el.open);
  });
})();


const on = (el, evt, fn) => el?.addEventListener(evt, fn);
const onAll = (selector, evt, fn) =>
  document.querySelectorAll(selector).forEach((el) => el.addEventListener(evt, fn));

function wireDropTarget(el) {
  if (!el) return;

  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(el, true);
  });

  el.addEventListener("dragleave", () => setDragOver(el, false));

  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(el, false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    try {
      await App.importFiles.importAnyFile(file);
      actions.refreshBatchCopyEnabled?.();
    } catch (err) {
      if (App.errors?.show) App.errors.show(App.ui, "Import failed", err);
      else App.ui.showToast("Could not import that file.", "error", 3200);
    }
  });
}

// Buttons
on(downloadBtn, "click", actions.handleDownloadSingle);
on(copyBtn, "click", actions.handleCopy);

on(downloadZipBtn, "click", actions.handleDownloadZipBatch);

on(resetBtn, "click", actions.resetAll);
on(resetBtnBatch, "click", actions.resetAll);

// on(showQrBtn, "click", actions.handleShowQr);

on(qrCopyUrlBtn, "click", actions.handleQrCopyUrl);
on(qrCopySvgBtn, "click", actions.handleQrCopySvg);
on(qrDlPngBtn, "click", actions.handleQrDownloadPng);
on(qrDlSvgBtn, "click", actions.handleQrDownloadSvg);

on(factoryResetBtn, "click", actions.handleFactoryReset);

on(downloadCsvBtn, "click", actions.handleDownloadCsvBatch);
on(downloadJsonBtn, "click", actions.handleDownloadJsonBatch);
on(downloadBatchFileBtn, "click", actions.handleDownloadBatchFile);

on(openNowBtn, "click", actions.handleOpenNow);
on(openFirstBtn, "click", actions.handleOpenFirstValidBatch);

on(copyBatchCsvBtn, "click", () => actions.handleCopyBatch?.("csv"));
on(copyBatchJsonBtn, "click", () => actions.handleCopyBatch?.("json"));
on(copyBatchUrlsBtn, "click", () => actions.handleCopyBatch?.("urls"));

on(chooseImportBtn, "click", () => actions.handleChooseImportClick(importAnyFileInput));
on(importAnyFileInput, "change", () => actions.handleImportAnyFileSelected(importAnyFileInput));

// urlMode radios: preview + batch refresh + QR refresh
onAll('input[name="urlMode"]', "change", () => {
  updatePreview();
  actions.refreshBatchCopyEnabled?.();
  actions.scheduleQrRefresh?.("urlMode");
});

// QR appearance / tuning → one unified handler
on(qrFg, "input", () => actions.handleQrUiChanged?.("appearance"));
on(qrFg, "change", () => actions.handleQrUiChanged?.("appearance"));

on(qrBg, "input", () => actions.handleQrUiChanged?.("appearance"));
on(qrBg, "change", () => actions.handleQrUiChanged?.("appearance"));

on(qrTransparent, "input", () => actions.handleQrUiChanged?.("appearance"));
on(qrTransparent, "change", () => actions.handleQrUiChanged?.("appearance"));

on(qrMargin, "input", () => actions.handleQrUiChanged?.("tuning"));
on(qrMargin, "change", () => actions.handleQrUiChanged?.("tuning"));

on(qrSize, "change", () => actions.handleQrUiChanged?.("tuning"));
on(qrEcc, "change", () => actions.handleQrUiChanged?.("tuning"));

// Dedupe mode dropdown
on(dedupeModeEl, "change", () => {
  updatePreview();
  actions.refreshBatchCopyEnabled?.();
});

// Enter-to-download in single URL box
on(urlInput, "keydown", (e) => {
  if (e.key === "Enter") actions.handleDownloadSingle();
});

// Single input changes
on(fileNameInput, "input", updatePreview);

on(urlInput, "input", () => {
  updatePreview();
  actions.refreshSingleActionsEnabled?.();
  actions.updateQrSummaryText?.();
  actions.scheduleQrRefresh?.("urlInput");
});

// Batch input changes
on(batchInput, "input", () => {
  updatePreview();
  actions.refreshBatchCopyEnabled?.();
});
on(zipNameInput, "input", updatePreview);

// Invalid panel toggle
on(toggleInvalidBtn, "click", () => {
  if (!invalidBody || !toggleInvalidBtn) return;
  const willOpen = invalidBody.hidden;
  invalidBody.hidden = !willOpen;
  toggleInvalidBtn.textContent = willOpen ? "Hide" : "Show";
});

// Drop targets
wireDropTarget(dropZone);
wireDropTarget(batchInput);

// Options that affect preview/copy state
[optDedupe, optExportCsv, optExportJson, optQrPng, optQrSvg].forEach((el) => {
  if (!el) return;
  el.addEventListener("change", () => {
    refreshDedupeStrengthVisibility();
    refreshBatchQrOptionsVisibility();
    updatePreview();
    actions.refreshBatchCopyEnabled?.();
  });
});

// File type radios
onAll('input[name="fileType"]', "change", () => {
  App.ui.updateTypeSelectionUI();
  updatePreview();
});

// Mode radios
onAll('input[name="mode"]', "change", App.ui.updateModeUI);
