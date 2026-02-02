// lib/actions.js
(function () {
  window.App = window.App || {};

  //
  // Initializes all action handlers and returns them so app.js can bind events.
  //

  function init(deps) {
    const d = deps || {};

    const must = (key) => {
      if (!d[key]) throw new Error(`App.actions.init: missing dep "${key}"`);
      return d[key];
    };

    // ---------------------------------------------------------------------------
    // Dependencies (injected by app.js)
    // - Required: core inputs + builders + preview refresh
    // - Optional: UI helpers + optional feature inputs + QR DOM
    // ---------------------------------------------------------------------------

    // --- Required: core inputs + core builders
    const urlInputEl = must("urlInputEl");
    const batchInputEl = must("batchInputEl");
    const zipNameInputEl = must("zipNameInputEl");

    const getDerivedFilename = must("getDerivedFilename");
    const buildBatchPlanFromUI = must("buildBatchPlanFromUI");
    const updatePreview = must("updatePreview");

    // --- UI adapter (prefer injected UI; fallback to App.ui)
    const ui = d.ui || App.ui;

    // --- Optional: single-mode input helpers
    const fileNameInputEl = d.fileNameInputEl || null;

    // --- Optional: batch-mode UI helpers (enable/disable convenience)
    const openFirstBtnEl = d.openFirstBtnEl || null;
    const copyBtnEl = d.copyBtnEl || null;

    // const copyBatchBtnEl = d.copyBatchBtnEl || null;
    // const copyBatchSelectEl = d.copyBatchSelectEl || null;

    const downloadZipBtnEl = d.downloadZipBtnEl || null;
    const downloadCsvBtnEl = d.downloadCsvBtnEl || null;
    const downloadJsonBtnEl = d.downloadJsonBtnEl || null;
    const downloadBatchFileBtnEl = d.downloadBatchFileBtnEl || null;

    const copyBatchCsvBtnEl = d.copyBatchCsvBtnEl || null;
    const copyBatchJsonBtnEl = d.copyBatchJsonBtnEl || null;
    const copyBatchUrlsBtnEl = d.copyBatchUrlsBtnEl || null;

    // const resetBtnBatchEl = d.resetBtnBatchEl || null;

    // --- Optional: batch options (used by reset/factory reset flows)
    const optDedupeEl = d.optDedupeEl || null;
    const optExportCsvEl = d.optExportCsvEl || null;
    const optExportJsonEl = d.optExportJsonEl || null;
    const optImportAppendEl = d.optImportAppendEl || null;

    // --- Optional: QR panel + outputs
    const showQrBtnEl = d.showQrBtnEl || null;
    const qrPanelEl = d.qrPanelEl || null;

    const qrImgEl = d.qrImgEl || null;
    const qrUrlLabelEl = d.qrUrlLabelEl || null;
    const qrWarnEl = d.qrWarnEl || null;

    // --- Optional: QR actions (copy/download)
    const qrCopyUrlBtnEl = d.qrCopyUrlBtnEl || null;
    const qrCopySvgBtnEl = d.qrCopySvgBtnEl || null;
    const qrDlPngBtnEl = d.qrDlPngBtnEl || null;
    const qrDlSvgBtnEl = d.qrDlSvgBtnEl || null;

    // --- Optional: QR appearance + tuning inputs
    const qrFgEl = d.qrFgEl || null;
    const qrBgEl = d.qrBgEl || null;
    const qrTransparentEl = d.qrTransparentEl || null;

    const qrMarginEl = d.qrMarginEl || null;
    const qrSizeEl = d.qrSizeEl || null;
    const qrEccEl = d.qrEccEl || null;

    // --- Optional: QR format flags (used by reset/factory reset flows)
    const optQrPngEl = d.optQrPngEl || null;
    const optQrSvgEl = d.optQrSvgEl || null;

    // -------------------------
    // Deps + helpers
    // -------------------------

    function cleanBaseName(raw) {
      const s = String(raw || "").trim();
      if (!s) return "";

      // strip common extensions users might type
      return s.replace(/\.(zip|csv|json|html|url|webloc)$/i, "").trim();
    }

    function safeBaseName(raw) {
      const base = cleanBaseName(raw);
      if (!base) return "";
      // keep it simple + cross-platform
      return base.replace(/[^a-z0-9._-]/gi, "_").replace(/_+/g, "_").slice(0, 200);
    }

    function getGlobalBaseName() {
      // global input is currently zipNameInputEl
      return safeBaseName(zipNameInputEl?.value);
    }

    function filenameWithExt(base, ext) {
      const b = safeBaseName(base);
      const e = String(ext || "").replace(/^\./, "");
      if (!b) return "";
      return `${b}.${e}`;
    }

    function extForType(t) {
      const type = String(t || "").toLowerCase();
      if (type === "url") return "url";
      if (type === "webloc") return "webloc";
      return "html";
    }

    function getBaseNamePreferUserInput() {
      return safeBaseName(fileNameInputEl?.value) || getGlobalBaseName();
    }

    function makeSingleDownloadName(effectiveUrl, type) {
      const base = getBaseNamePreferUserInput();
      return base
        ? filenameWithExt(base, extForType(type))
        : getDerivedFilename(effectiveUrl, type);
    }

    function requireBatchPlan({ requireValid = true } = {}) {
      const plan = buildBatchPlanFromUI();

      if (!plan.lines || plan.lines.length === 0) {
        updatePreview();
        ui.showToast("Paste at least one URL (one per line).", "error", 2600);
        return null;
      }

      if (requireValid && (!plan.deduped || plan.deduped.length === 0)) {
        updatePreview();
        ui.showToast("No valid URLs found.", "error", 2600);
        return null;
      }

      return plan;
    }

    function flashButton(btn, text = "Copied!", ms = 1000) {
      if (!btn) return;

      // store per-element state so rapid clicks behave
      const stateKey = "__flashState";
      const st = btn[stateKey] || { timer: null, prevText: null, prevValue: null };
      btn[stateKey] = st;

      // clear any prior timer
      if (st.timer) {
        clearTimeout(st.timer);
        st.timer = null;
      }

      // determine what to change (button vs input)
      const isInputLike =
        btn.tagName === "INPUT" || btn.tagName === "TEXTAREA" || btn.tagName === "SELECT";

      if (isInputLike) {
        if (st.prevValue == null) st.prevValue = btn.value;
        btn.value = text;
      } else {
        if (st.prevText == null) st.prevText = btn.textContent;
        btn.textContent = text;
      }

      btn.classList?.add?.("flash");

      st.timer = window.setTimeout(() => {
        if (isInputLike) {
          btn.value = st.prevValue ?? btn.value;
        } else {
          btn.textContent = st.prevText ?? btn.textContent;
        }

        btn.classList?.remove?.("flash");

        // reset stored originals so future flashes re-capture correctly
        btn[stateKey] = { timer: null, prevText: null, prevValue: null };
      }, ms);
    }

    function handleChooseImportClick(importAnyFileInputEl) {
      if (!importAnyFileInputEl) return;
      importAnyFileInputEl.value = "";
      importAnyFileInputEl.click();
    }

    async function handleImportAnyFileSelected(importAnyFileInputEl) {
      const file = importAnyFileInputEl?.files?.[0];
      if (!file) return;

      try {
        await App.importFiles.importAnyFile(file);
      } catch (e) {
        if (App.errors?.show) App.errors.show(ui, "Import failed", e);
        else ui.showToast("Could not import that file.", "error", 3200);
      }
    }

    // -------------------------
    // Single actions
    // -------------------------

    function handleDownloadSingle() {
      const norm = App.url.normalizeUrl(urlInputEl?.value);
      if (!norm.ok) {
        updatePreview();
        ui.showToast(norm.reason, "error", 2600);
        return;
      }

      const type = ui.getSelectedType();
      
      const mode = ui?.getUrlMode ? ui.getUrlMode() : "full";
      const effective = App.url.applyUrlMode(norm.url, mode);

      const out = App.outputBuilders.buildFileContents(effective, type);
      if (!out) {
        updatePreview();
        ui.showToast("Unknown file type selected.", "error", 2600);
        return;
      }

      const name = makeSingleDownloadName(effective, type);

      try {
        App.download.downloadBlob(name, new Blob([out.contents], { type: out.mime }));
      } catch (e) {
        updatePreview();
        if (App.errors?.show) App.errors.show(ui, "Download failed", e);
        else ui.showToast("Download failed.", "error", 3200);
        return;
      }

      App.history?.recordSingle({
        url: effective,
        type,
        source: "download",
        fileName: fileNameInputEl?.value || "",
      });

      updatePreview();
      ui.showToast(`Downloaded: ${name}`, "success", 2200);
    }

    async function handleCopy() {
      const norm = App.url.normalizeUrl(urlInputEl?.value);
      if (!norm.ok) {
        updatePreview();
        ui.showToast(norm.reason, "error", 2600);
        return;
      }

      // Apply URL mode (full / stripTracking / stripAll)
      const mode = ui?.getUrlMode ? ui.getUrlMode() : "full";
      const effective = App.url.applyUrlMode(norm.url, mode);

      try {
        await navigator.clipboard.writeText(effective);

        App.history?.recordSingle({
          url: effective,
          type: ui.getSelectedType(),
          source: "copy",
          label: `copy (${mode})`,
          fileName: fileNameInputEl?.value || "",
        });

        // Flash the button label (no disabling)
        flashButton(copyBtnEl, "Copied!", 1000);

        updatePreview();
        ui.showToast(`Copied URL (${mode})`, "success", 1800);
      } catch (e) {
        if (App.errors?.show) {
          App.errors.show(
            ui,
            "Clipboard blocked",
            new Error("Browser blocked clipboard access. Use HTTPS or allow clipboard permissions.")
          );
        } else {
          ui.showToast("Could not access clipboard (browser blocked it).", "error", 2600);
        }
      }
    }

    function handleOpenNow() {
      const raw = urlInputEl?.value?.trim() || "";
      if (!raw) {
        updatePreview();
        ui.showToast("Enter a URL first.", "error", 2200);
        return;
      }

      const norm = App.url.normalizeUrl(raw);
      if (!norm.ok) {
        updatePreview();
        ui.showToast(norm.reason, "error", 2600);
        return;
      }

      // Use noopener to avoid giving the opened page access to window.opener
      // const w = window.open(norm.url, "_blank", "noopener,noreferrer");

      const mode = ui?.getUrlMode ? ui.getUrlMode() : "full";
      const effective = App.url.applyUrlMode(norm.url, mode);

      const w = window.open(effective, "_blank", "noopener,noreferrer");

      if (!w) {
        ui.showToast("Pop-up blocked. Allow pop-ups for this site to use Open link now.", "error", 3600);
        return;
      }

      ui.showToast("Opened link in a new tab.", "success", 1800);

      App.history?.recordSingle({
        url: effective,
        type: ui.getSelectedType(),
        source: "open",
        fileName: fileNameInputEl?.value || "",
      });
    }

    // -------------------------
    // Batch actions
    // -------------------------

    async function handleDownloadZipBatch() {

      const plan = requireBatchPlan();
      if (!plan) return;

      try {
        plan.options = plan.options || {};
        plan.options.qrRender = getQrRenderOpts();

        const { blob, zipName, fileCount } = await App.zip.buildZipFromUrls(
          plan.deduped,
          plan.type,
          plan.zipBaseName,
          plan.options,
          {
            url: App.url,
            outputBuilders: App.outputBuilders,
            exporter: App.exporter,
          }
        );

        App.download.downloadBlob(zipName, blob);

        App.history?.recordBatch({
          urls: plan.deduped.map((x) => x.url),
          type: plan.type,
          zipBaseName: plan.zipBaseName,
          source: "zip",
        });

        updatePreview();
        let msg = `ZIP downloaded (${fileCount} file(s)).`;
        if (plan.options.dedupe && plan.removedCount) msg += ` Removed ${plan.removedCount} duplicate(s).`;
        if (plan.invalid.length) msg += ` Skipped ${plan.invalid.length} invalid line(s).`;
        ui.showToast(msg, "success", 3200);
      } catch (e) {
        updatePreview();

        // Friendly message + console details
        if (App.errors?.show) {
          App.errors.show(ui, "Failed to build ZIP", e);
        } else {
          ui.showToast(e?.message || "Failed to build ZIP.", "error", 3200);
        }
      }
    }

    function handleDownloadCsvBatch() {

      const plan = requireBatchPlan();
      if (!plan) return;


      let rows, csv, outName;
      try {
        rows = App.exporter.buildExportRowsForBatch(plan, { url: App.url });
        csv = App.exporter.buildCsvExport(rows, plan.options?.exportFields);

        const base = getGlobalBaseName() || "export";
        outName = filenameWithExt(base, "csv");

        App.download.downloadBlob(
          outName,
          new Blob([csv], { type: "text/csv;charset=utf-8" })
        );
      } catch (e) {
        updatePreview();
        if (App.errors?.show) App.errors.show(ui, "Failed to export CSV", e);
        else ui.showToast("Failed to export CSV.", "error", 3200);
        return;
      }

      App.history?.recordBatch({
        urls: plan.deduped.map((x) => x.url),
        type: plan.type,
        zipBaseName: plan.zipBaseName,
        source: "csv",
        label: "DOWNLOAD CSV",
        replace: true, // optional; only if you want it shown
      });

      updatePreview();
      ui.showToast(`Downloaded ${outName} (${rows.length} row(s)).`, "success", 2600);
    }

    function handleDownloadJsonBatch() {

      const plan = requireBatchPlan();
      if (!plan) return;

      let rows, json, outName;
      try {
        rows = App.exporter.buildExportRowsForBatch(plan, { url: App.url });
        json = App.exporter.buildJsonExport(rows, plan.options?.exportFields);

        const base = getGlobalBaseName() || "export";
        outName = filenameWithExt(base, "json");

        App.download.downloadBlob(
          outName,
          new Blob([json], { type: "application/json;charset=utf-8" })
        );
      } catch (e) {
        updatePreview();
        if (App.errors?.show) App.errors.show(ui, "Failed to export JSON", e);
        else ui.showToast("Failed to export JSON.", "error", 3200);
        return;
      }

      App.history?.recordBatch({
        urls: plan.deduped.map((x) => x.url),
        type: plan.type,
        zipBaseName: plan.zipBaseName,
        source: "json",
        label: "DOWNLOAD JSON",
        replace: true, // optional
      });

      updatePreview();
      ui.showToast(`Downloaded ${outName} (${rows.length} item(s)).`, "success", 2600);
    }

    function handleDownloadBatchFile() {

      const plan = requireBatchPlan({ requireValid: false });
      if (!plan) return;
      if (!plan.valid?.length) {
        updatePreview();
        ui.showToast("No valid URLs found.", "error", 2600);
        return;
      }

      let batchJson, filename;
      try {
        batchJson = App.batchFile.buildBatchFileJson(plan);

        const base = getGlobalBaseName() || "batch";
        filename = `${safeBaseName(base)}.linkbundle.json`;

        App.download.downloadBlob(
          filename,
          new Blob([batchJson], { type: "application/json;charset=utf-8" })
        );
      } catch (e) {
        updatePreview();
        if (App.errors?.show) App.errors.show(ui, "Failed to build Batch File", e);
        else ui.showToast("Failed to build Batch File.", "error", 3200);
        return;
      }

      App.history?.recordBatch({
        urls: plan.deduped.map((x) => x.url),
        type: plan.type,
        zipBaseName: plan.zipBaseName,
        source: "batchfile",
      });

      updatePreview();
      ui.showToast(`Downloaded ${filename}.`, "success", 2600);
    }

    async function handleCopyBatch(choice = "csv") {
      const plan = requireBatchPlan();
      if (!plan) return;

      // valid URLs exist → ensure enabled
      setCopyBatchEnabled(true);

      const rows = App.exporter.buildExportRowsForBatch(plan, { url: App.url });
      const exportFields = plan.options?.exportFields;

      let text = "";
      let label = "";

      if (choice === "csv") {
        text = App.exporter.buildCsvExport(rows, exportFields);
        label = `Copied CSV (${rows.length} row(s))`;
      } else if (choice === "json") {
        text = App.exporter.buildJsonExport(rows, exportFields);
        label = `Copied JSON (${rows.length} item(s))`;
      } else {
        // "urls"
        text = plan.deduped.map((x) => x.url || x.raw).filter(Boolean).join("\n") + "\n";
        label = `Copied URL list (${plan.deduped.length} URL(s))`;
      }

      // Pick the right button to "flash"
      const btnToFlash =
        choice === "csv"
          ? copyBatchCsvBtnEl
          : choice === "json"
          ? copyBatchJsonBtnEl
          : copyBatchUrlsBtnEl;

      try {
        await navigator.clipboard.writeText(text);

        App.history?.recordEvent?.({
          source: "copy",
          label: choice === "urls" ? "COPY URL LIST" : choice === "csv" ? "COPY CSV" : "COPY JSON",
          details: `${plan.deduped.length} valid (deduped)`,
          copyText: text,
        });

        updatePreview();
        ui.showToast(label, "success", 2200);

        // Micro-state on the button that was clicked
        flashButton(btnToFlash, "Copied!", 1000);
      } catch {
        if (App.errors?.show) {
          App.errors.show(
            ui,
            "Clipboard blocked",
            new Error("Browser blocked clipboard access. Use HTTPS or allow clipboard permissions.")
          );
        } else {
          ui.showToast("Could not access clipboard (browser blocked it).", "error", 2600);
        }
      }
    }

    function handleOpenFirstValidBatch() {
      
      const plan = requireBatchPlan();
      if (!plan) return;

      const first = plan.valid[0]?.url;
      const w = window.open(first, "_blank", "noopener,noreferrer");
      if (!w) {
        ui.showToast("Pop-up blocked. Allow pop-ups for this site to open links.", "error", 3600);
        return;
      }

      ui.showToast("Opened first valid URL.", "success", 1800);
    }    

    function setBatchClearEnabled(enabled) {
      if (resetBtnBatchEl) resetBtnBatchEl.disabled = !enabled;
    }

    function refreshBatchCopyEnabled() {
      try {
        const plan = buildBatchPlanFromUI();
        const hasAnyLines = !!(plan?.lines && plan.lines.length > 0);
        const hasValid = !!(plan?.valid && plan.valid.length > 0);
        const hasDeduped = !!(plan?.deduped && plan.deduped.length > 0);

        setCopyBatchEnabled(hasDeduped);
        setOpenFirstEnabled(hasAnyLines && hasValid);

        // Clear: enable only if there's something to clear
        setBatchClearEnabled(hasAnyLines);
      } catch {
        setCopyBatchEnabled(false);
        setOpenFirstEnabled(false);
        setBatchClearEnabled(false);
      }
    }

    function setBatchDownloadEnabled(enabled) {
      if (downloadZipBtnEl) downloadZipBtnEl.disabled = !enabled;
      if (downloadCsvBtnEl) downloadCsvBtnEl.disabled = !enabled;
      if (downloadJsonBtnEl) downloadJsonBtnEl.disabled = !enabled;
      if (downloadBatchFileBtnEl) downloadBatchFileBtnEl.disabled = !enabled;
    }

    function setCopyBatchEnabled(enabled) {
      // if (copyBatchBtnEl) copyBatchBtnEl.disabled = !enabled;
      // if (copyBatchSelectEl) copyBatchSelectEl.disabled = !enabled;

      if (copyBatchCsvBtnEl) copyBatchCsvBtnEl.disabled = !enabled;
      if (copyBatchJsonBtnEl) copyBatchJsonBtnEl.disabled = !enabled;
      if (copyBatchUrlsBtnEl) copyBatchUrlsBtnEl.disabled = !enabled;
    }

    function setOpenFirstEnabled(enabled) {
      if (openFirstBtnEl) openFirstBtnEl.disabled = !enabled;
    }

    // -------------------------
    // QR module
    // -------------------------
    const QR_PANEL_OPEN_KEY = "lfg_qr_panel_open_v1";
    let lastQr = { url: "", svg: "", pngBlob: null };
    let lastQrObjUrl = "";
    let qrRefreshTimer = 0;
    let lastRenderedQrKey = ""; // replaces/augments lastRenderedEffectiveUrl

    // QR persistence helpers

    function saveQrPanelOpen(isOpen) {
      try { localStorage.setItem(QR_PANEL_OPEN_KEY, isOpen ? "1" : "0"); } catch {}
    }

    function loadQrPanelOpen() {
      try { return localStorage.getItem(QR_PANEL_OPEN_KEY) === "1"; } catch { return false; }
    }

    function restoreQrPanelState() {
      const shouldOpen = loadQrPanelOpen();
      if (!qrPanelEl) return;

      qrPanelEl.hidden = !shouldOpen;
      syncShowQrButtonLabel();

      if (shouldOpen) scheduleQrRefresh("restore");
    }

    function syncShowQrButtonLabel() {
      if (!showQrBtnEl) return;
      showQrBtnEl.textContent = isQrPanelOpen() ? "Hide QR" : "Show QR";
    }

    function isQrPanelOpen() {
      return !!(qrPanelEl && qrPanelEl.hidden === false);
    }

    // QR render helpers

    function getQrRenderOpts() {
      const transparent = !!qrTransparentEl?.checked;
      const foreground = (qrFgEl?.value || "#000000").toLowerCase();
      const background = (qrBgEl?.value || "#ffffff").toLowerCase();

      // Border size (quiet zone) in modules
      const v = String(qrMarginEl?.value ?? "").trim();
      const marginRaw = v === "" ? 4 : parseInt(v, 10);
      const margin = Number.isFinite(marginRaw) ? Math.max(0, Math.min(32, marginRaw)) : 4;

      // Download size mapping → scale (pixels per module)
      // You can change these values later without breaking storage
      const sizeChoice = String(qrSizeEl?.value || "medium").toLowerCase();
      const scale =
        sizeChoice === "small" ? 6 :
        sizeChoice === "large" ? 12 :
        8; // medium default

      const ecc = String(qrEccEl?.value || "M").toUpperCase();

      return { foreground, background, transparent, margin, scale, ecc };
    }

    async function renderSingleQr() {
      if (!App?.qr) throw new Error("QR not available (App.qr missing).");

      const raw = urlInputEl?.value?.trim() || "";
      const norm = App.url.normalizeUrl(raw);
      if (!norm.ok) throw new Error(norm.reason || "Enter a valid URL first.");

      const mode = ui?.getUrlMode ? ui.getUrlMode() : "full";
      const url = App.url.applyUrlMode(norm.url, mode);

      const opts = getQrRenderOpts();

      const sv = App.qr.buildSvgForUrl(url, opts);
      if (!sv.ok) throw new Error(sv.reason || "Failed to build SVG.");

      const pn = await App.qr.buildPngBlobForUrl(url, opts);
      if (!pn.ok || !pn.blob) throw new Error(pn.reason || "Failed to render PNG.");

      lastQr = { url, svg: sv.svg, pngBlob: pn.blob };

      // warning should reflect current opts
      updateQrContrastWarning(opts);

      // signature/key should reflect url + opts
      lastRenderedQrKey = makeQrKey(url, opts);

      if (qrUrlLabelEl) qrUrlLabelEl.textContent = url;

      if (qrImgEl) {
        if (lastQrObjUrl) {
          try { URL.revokeObjectURL(lastQrObjUrl); } catch {}
          lastQrObjUrl = "";
        }

        lastQrObjUrl = URL.createObjectURL(pn.blob);
        qrImgEl.src = lastQrObjUrl;
      }
    }

    function makeQrKey(effectiveUrl, renderOpts) {
      // Keep it stable and small
      const o = renderOpts || {};
      return [
        effectiveUrl || "",
        (o.foreground || "").toLowerCase(),
        (o.background || "").toLowerCase(),
        o.transparent ? "t" : "o",
        String(o.margin ?? ""),
        String(o.scale ?? ""),
        String(o.ecc ?? ""),
      ].join("|");
    }

    function scheduleQrRefresh(reason = "input") {
      if (!isQrPanelOpen()) return;

      // clear any pending refresh
      if (qrRefreshTimer) window.clearTimeout(qrRefreshTimer);

      qrRefreshTimer = window.setTimeout(async () => {
        qrRefreshTimer = 0;

        // Only update QR when we have a valid URL
        const raw = urlInputEl?.value?.trim() || "";
        const norm = App.url.normalizeUrl(raw);

        if (!norm.ok) {
          // If user made URL invalid while panel open, blank preview (clean UX)
          clearQrPreviewUi();
          return;
        }

        const mode = ui?.getUrlMode ? ui.getUrlMode() : "full";
        const effective = App.url.applyUrlMode(norm.url, mode);

        const opts = getQrRenderOpts();
        const key = makeQrKey(effective, opts);

        if (key === lastRenderedQrKey) return;

        try {
          await renderSingleQr();
          // renderSingleQr sets lastRenderedQrKey on success
        } catch {
          clearQrPreviewUi();
        }
      }, 50); // debounce delay (tweak if you want)
    }

    function handleQrUiChanged(reason = "ui") {
      try {
        const opts = getQrRenderOpts();
        updateQrContrastWarning(opts);
      } catch {}
      scheduleQrRefresh(reason);
    }

    function clearQrPreviewUi() {
      // Clear memory + UI
      lastQr = { url: "", svg: "", pngBlob: null };
      lastRenderedQrKey = "";

      if (qrUrlLabelEl) qrUrlLabelEl.textContent = "";
      if (qrImgEl) qrImgEl.removeAttribute("src");

      if (lastQrObjUrl) {
        try { URL.revokeObjectURL(lastQrObjUrl); } catch {}
        lastQrObjUrl = "";
      }
    }

    // QR appearance + contrast warning helpers

    function hexToRgb(hex) {
      const h = String(hex || "").replace("#", "").trim();
      if (h.length !== 6) return null;
      const n = parseInt(h, 16);
      if (!Number.isFinite(n)) return null;
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function srgbToLin(c) {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }

    function relLuminance(rgb) {
      const R = srgbToLin(rgb.r);
      const G = srgbToLin(rgb.g);
      const B = srgbToLin(rgb.b);
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }

    function contrastRatio(fgHex, bgHex) {
      const fg = hexToRgb(fgHex);
      const bg = hexToRgb(bgHex);
      if (!fg || !bg) return null;
      const L1 = relLuminance(fg);
      const L2 = relLuminance(bg);
      const lighter = Math.max(L1, L2);
      const darker = Math.min(L1, L2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function updateQrContrastWarning({ foreground, background, transparent }) {
      if (!qrWarnEl) return;

      // Transparent: unknown actual background, so don’t warn.
      if (transparent) {
        qrWarnEl.style.display = "none";
        return;
      }

      const ratio = contrastRatio(foreground, background);

      // Warning threshold: 4.5 is a good “might be hard to scan” cutoff.
      const low = ratio != null && ratio < 4.5;

      qrWarnEl.style.display = low ? "" : "none";
    }

    // QR user actions

    async function handleShowQr() {
      // Toggle behavior
      if (isQrPanelOpen()) {
        handleCloseQr();
        return;
      }

      try {
        if (qrPanelEl) qrPanelEl.hidden = false;
        saveQrPanelOpen(true);
        syncShowQrButtonLabel();

        await renderSingleQr();            // renders only if URL valid; throws if not
        ui.showToast("QR ready.", "success", 1600);
      } catch (e) {
        // Keep panel open if you prefer; I’m keeping your current behavior: hide on failure
        if (qrPanelEl) qrPanelEl.hidden = true;
        saveQrPanelOpen(false);
        syncShowQrButtonLabel();

        if (App.errors?.show) App.errors.show(ui, "QR failed", e);
        else ui.showToast(e?.message || "QR failed.", "error", 2600);
      }
    }

    function handleCloseQr() {
      if (qrPanelEl) qrPanelEl.hidden = true;
      saveQrPanelOpen(false);
      syncShowQrButtonLabel();

      // cleanup preview + state (your earlier good behavior)
      if (lastQrObjUrl) {
        try { URL.revokeObjectURL(lastQrObjUrl); } catch {}
        lastQrObjUrl = "";
      }

      lastQr = { url: "", svg: "", pngBlob: null };
      lastRenderedQrKey = "";
      if (qrUrlLabelEl) qrUrlLabelEl.textContent = "";
      if (qrImgEl) qrImgEl.removeAttribute("src");
    }

    async function handleQrCopyUrl() {
      try {
        if (!lastQr.url) throw new Error("Open QR first.");
        await navigator.clipboard.writeText(lastQr.url);
        flashButton(qrCopyUrlBtnEl, "Copied!", 900);
        ui.showToast("Copied URL.", "success", 1600);
      } catch (e) {
        if (App.errors?.show) App.errors.show(ui, "Clipboard blocked", e);
        else ui.showToast("Clipboard blocked.", "error", 2600);
      }
    }

    async function handleQrCopySvg() {
      try {
        if (!lastQr.svg) throw new Error("Open QR first.");
        await navigator.clipboard.writeText(lastQr.svg);
        flashButton(qrCopySvgBtnEl, "Copied!", 900);
        ui.showToast("Copied SVG.", "success", 1600);
      } catch (e) {
        if (App.errors?.show) App.errors.show(ui, "Clipboard blocked", e);
        else ui.showToast("Clipboard blocked.", "error", 2600);
      }
    }

    function handleQrDownloadPng() {
      if (!lastQr.pngBlob) return ui.showToast("Open QR first.", "error", 2200);

      const base = getBaseNamePreferUserInput() || "qr";

      const name = `${base}-qr.png`;

      App.download.downloadBlob(name, lastQr.pngBlob);
      ui.showToast(`Downloaded ${name}`, "success", 1600);
    }

    function handleQrDownloadSvg() {
      if (!lastQr.svg) return ui.showToast("Open QR first.", "error", 2200);

      const base = getBaseNamePreferUserInput() || "qr";

      const name = `${base}-qr.svg`;

      App.download.downloadBlob(
        name,
        new Blob([lastQr.svg], { type: "image/svg+xml;charset=utf-8" })
      );

      ui.showToast(`Downloaded ${name}`, "success", 1600);
    }

    // -------------------------
    // Reset / Clear
    // -------------------------

    function resetAll() {
      if (urlInputEl) urlInputEl.value = "";
      if (fileNameInputEl) fileNameInputEl.value = "";
      if (batchInputEl) batchInputEl.value = "";
      if (zipNameInputEl) zipNameInputEl.value = "";

      // Restore your current defaults
      if (optDedupeEl) optDedupeEl.checked = false;
      if (optExportCsvEl) optExportCsvEl.checked = true;
      if (optExportJsonEl) optExportJsonEl.checked = true;

      if (ui?.updateTypeSelectionUI) ui.updateTypeSelectionUI();

      if (typeof updatePreview === "function") updatePreview();

      ui?.showToast?.("Reset complete.", "success", 1800);
    }

    function handleFactoryReset() {
      try {
        const ok = window.confirm(
          "Factory reset will clear all saved settings and history for this app. Continue?"
        );
        if (!ok) return;

        // 1) Clear stored app state (settings, inputs, schema, qr options, url mode)
        App.state?.clearAllAppState?.();

        // 2) Clear history too (relies on history.js having the GOOD clearAll)
        App.history?.clearAll?.();

        // 3) Reset UI back to defaults (so UI matches cleared storage immediately)
        if (urlInputEl) urlInputEl.value = "";
        if (fileNameInputEl) fileNameInputEl.value = "";
        if (batchInputEl) batchInputEl.value = "";
        if (zipNameInputEl) zipNameInputEl.value = "";

        if (optDedupeEl) optDedupeEl.checked = false;
        if (optExportCsvEl) optExportCsvEl.checked = true;
        if (optExportJsonEl) optExportJsonEl.checked = true;

        // If these exist in actions.js scope, reset them too
        // (Prefer locals captured from deps; see notes below)
        if (optImportAppendEl) optImportAppendEl.checked = true;
        if (optQrPngEl) optQrPngEl.checked = false;
        if (optQrSvgEl) optQrSvgEl.checked = false;

        // Reset mode/type/urlMode to defaults
        ui?.setMode?.("single");
        ui?.setSelectedType?.("html");
        ui?.setUrlMode?.("full");

        ui?.updateModeUI?.();
        ui?.updateTypeSelectionUI?.();

        // Close QR panel + cleanup any object URL
        if (qrPanelEl) qrPanelEl.hidden = true;
        if (typeof handleCloseQr === "function") handleCloseQr();

        // Reset export schema to defaults (and make label read "Defaults")
        App.exportSchema?.clearStorage?.();     // optional but makes it “wipe clean”
        App.exportSchema?.resetToDefaults?.();  // required to update UI immediately

        if (typeof updatePreview === "function") updatePreview();
        if (typeof refreshBatchCopyEnabled === "function") refreshBatchCopyEnabled();

        ui?.showToast?.("Factory reset complete.", "success", 2400);
      } catch (e) {
        if (App.errors?.show) App.errors.show(ui, "Factory reset failed", e);
        else ui?.showToast?.("Factory reset failed.", "error", 3200);
      }
    }

    return {
      handleDownloadSingle,
      handleDownloadZipBatch,
      handleDownloadCsvBatch,
      handleDownloadJsonBatch,
      handleDownloadBatchFile,
      handleCopy,
      handleCopyBatch,
      refreshBatchCopyEnabled,
      handleChooseImportClick,
      handleImportAnyFileSelected,
      handleOpenNow,
      handleOpenFirstValidBatch,

      // QR
      handleShowQr,
      handleCloseQr,
      handleQrCopyUrl,
      handleQrCopySvg,
      handleQrDownloadPng,
      handleQrDownloadSvg,
      scheduleQrRefresh,
      handleQrUiChanged,
      restoreQrPanelState,
      syncShowQrButtonLabel,
      
      resetAll,
      handleFactoryReset,
    };
  }

  window.App.actions = { init };
})();
