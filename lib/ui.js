// lib/ui.js
(function () {
  window.App = window.App || {};

  let ctx = null;

  let toastEl = null;
  let toastTimer = null;

  function init(c) {
    ctx = c || {};
    // Ensure the explainer lines reflect current persisted state on load
    updateTypeSelectionUI();
    updateFileTypeHelp();
    updateUrlModeHelp();
    wireExplainers();
  }

  function setPreviewStatus(msg) {
    if (!ctx?.statusEl) return;
    ctx.statusEl.textContent = msg || "";
  }

  function showToast(message, variant = "success", durationMs = 2200) {
    // Create once
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }

    // Reset timer
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    toastEl.classList.remove("success", "error");
    toastEl.classList.add(variant === "error" ? "error" : "success");
    toastEl.textContent = message;

    // Trigger show
    requestAnimationFrame(() => toastEl.classList.add("show"));

    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, durationMs);
  }

  function getMode() {
    return document.querySelector('input[name="mode"]:checked')?.value || "single";
  }

  function setMode(mode) {
    const m = mode === "batch" ? "batch" : "single";
    const r = document.querySelector(`input[name="mode"][value="${m}"]`);
    if (r) r.checked = true;
    updateModeUI();
  }

  function getSelectedType() {
    return document.querySelector('input[name="fileType"]:checked')?.value || "html";
  }

  function setSelectedType(type) {
    const allowed = new Set(["html", "url", "webloc"]);
    const t = allowed.has(type) ? type : "html";
    const r = document.querySelector(`input[name="fileType"][value="${t}"]`);
    if (r) r.checked = true;

    updateTypeSelectionUI();
    updateFileTypeHelp();
  }

  function updateTypeSelectionUI() {
    // Backward-compatible: if old .type cards still exist, keep working.
    document.querySelectorAll(".type").forEach((label) => {
      const radio = label.querySelector('input[type="radio"]');
      label.classList.toggle("selected", !!radio && radio.checked);
    });

    // New UI: pills/segments are styled via :has(input:checked), so no JS needed.
  }

  function updateModeUI() {
    const mode = getMode();

    if (ctx?.singlePanel) ctx.singlePanel.hidden = mode !== "single";
    if (ctx?.batchPanel) ctx.batchPanel.hidden = mode !== "batch";

    updateTypeSelectionUI();

    if (typeof ctx?.updatePreview === "function") {
      ctx.updatePreview();
    }
  }

  function getUrlMode() {
    return document.querySelector('input[name="urlMode"]:checked')?.value || "full";
  }

  function setUrlMode(mode) {
    const allowed = new Set(["full", "stripTracking", "stripAll"]);
    const m = allowed.has(mode) ? mode : "full";
    const r = document.querySelector(`input[name="urlMode"][value="${m}"]`);
    if (r) r.checked = true;

    updateUrlModeHelp();
  }

  function updateFileTypeHelp() {
    const el = document.getElementById("fileTypeHelp");
    if (!el) return;

    const t = getSelectedType();
    if (t === "html") {
      el.textContent = "HTML redirect files work everywhere. Double-click opens your browser and redirects immediately (recommended).";
      return;
    }
    if (t === "url") {
      el.textContent = "Windows .url shortcuts open natively in Windows. Best for Windows-only workflows.";
      return;
    }
    if (t === "webloc") {
      el.textContent = "macOS .webloc files open natively in macOS. Best for Mac-only workflows.";
      return;
    }
    el.textContent = "";
  }

  function updateUrlModeHelp() {
    const el = document.getElementById("urlModeHelp");
    if (!el) return;

    const m = getUrlMode();
    if (m === "full") {
      el.textContent = "Keeps the full URL exactly as provided (default).";
      return;
    }
    if (m === "stripTracking") {
      el.textContent = "Removes common tracking parameters (utm_*, fbclid, gclid, msclkid, etc.) but keeps other query parameters.";
      return;
    }
    if (m === "stripAll") {
      el.textContent = "Removes the entire query string (everything after “?”). Fragments (#...) are also removed in this mode.";
      return;
    }
    el.textContent = "";
  }

  let explainersWired = false;

  function wireExplainers() {
    if (explainersWired) return;
    explainersWired = true;

    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      if (t.matches('input[name="fileType"]')) return updateFileTypeHelp();
      if (t.matches('input[name="urlMode"]')) return updateUrlModeHelp();
      if (t.matches('input[name="mode"]')) return updateModeUI();
    });
  }

  window.App.ui = {
    init,
    setPreviewStatus,
    showToast,
    getMode,
    setMode,
    getSelectedType,
    setSelectedType,
    updateTypeSelectionUI,
    updateModeUI,
    getUrlMode,
    setUrlMode,
    updateFileTypeHelp,
    updateUrlModeHelp,
  };
})();
