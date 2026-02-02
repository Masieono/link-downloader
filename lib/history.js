// lib/history.js
(function () {
  window.App = window.App || {};

  const STORAGE_KEY = "lfg_history_v1";
  const MAX_ITEMS = 20;
  const HISTORY_OPEN_KEY = "lfg_history_open_v1";

  let ctx = {
    historyListEl: null,
    clearBtnEl: null,
    historyCountEl: null,
    detailsEl: null,

    // callbacks
    setMode: null,
    setSelectedType: null,
    setSingleUrl: null,
    setSingleFileName: null,
    setBatchText: null,
    setZipName: null,
    updatePreview: null,
    showToast: null,

    downloadSingleNow: null,
    downloadZipNow: null,
    downloadCsvNow: null,
    downloadJsonNow: null,
  };

  function saveHistoryOpen(isOpen) {
    try { localStorage.setItem(HISTORY_OPEN_KEY, isOpen ? "1" : "0"); } catch {}
  }

  function loadHistoryOpen() {
    try { return localStorage.getItem(HISTORY_OPEN_KEY) === "1"; } catch { return false; }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function save(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage failures
    }
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return "";
    }
  }

  function summarize(item) {
    const src = sourceLabel(item.source);
    const label = item.label ? ` · ${item.label}` : "";

    if (item.kind === "single") {
      return `${src}${label} · Single · .${item.type || "html"} · ${item.url || ""}`;
    }

    if (item.kind === "batch") {
      const n = Array.isArray(item.urls) ? item.urls.length : 0;
      const mode = typeof item.replace === "boolean" ? (item.replace ? " (Replace)" : " (Append)") : "";
      return `${src}${label} · Batch · .${item.type || "html"} · ${n} URL(s)${mode}`;
    }

    return `${src}${label}`.trim() || "History item";
  }

  function render() {
    const el = ctx.historyListEl;
    if (!el) return;

    const items = load();

    if (ctx.historyCountEl) {
      ctx.historyCountEl.textContent = items.length ? `(${items.length})` : "";
    }

    // Hide "Clear" button when there’s nothing to clear
    if (ctx.clearBtnEl) {
      ctx.clearBtnEl.hidden = items.length === 0;
    }

    if (items.length === 0) {
      el.innerHTML = `<div class="hint">No history yet. Actions like Download/Open/Copy/Import/Remove/Restore will appear here.</div>`;
      return;
    }

    let html = "";

    for (const item of items) {
      const title = summarize(item);
      const time = formatTime(item.createdAt);
      const id = item.id;

      const isSingle = item.kind === "single" && !!item.url;
      const isBatch = item.kind === "batch" && Array.isArray(item.urls) && item.urls.length > 0;
      const isCopyEvent =
        item.kind === "event" &&
        String(item.source || "").toLowerCase() === "copy" &&
        !!(item.copyText && item.copyText.trim());

      let actionsHtml = "";

      if (isSingle) {
        actionsHtml =
          `<button type="button" class="secondary small" data-act="copy">Copy URL</button>` +
          `<button type="button" class="secondary small" data-act="open">Open</button>` +
          `<button type="button" class="secondary small" data-act="download">Download</button>` +
          `<button type="button" class="secondary small" data-act="load">Restore</button>` +
          `<button type="button" class="secondary small danger" data-act="remove">Remove</button>`;
      } else if (isBatch) {
        const src = String(item.source || "").toLowerCase();
        const dlAct = (src === "csv") ? "csv"
                  : (src === "json") ? "json"
                  : "zip";

        const dlLabel = (src === "csv") ? "Download CSV"
                      : (src === "json") ? "Download JSON"
                      : "Download ZIP";

        actionsHtml =
          `<button type="button" class="secondary small" data-act="restore">Restore</button>` +
          `<button type="button" class="secondary small" data-act="${dlAct}">${dlLabel}</button>` +
          `<button type="button" class="secondary small" data-act="copyUrls">Copy URL list</button>` +
          `<button type="button" class="secondary small" data-act="remove">Remove</button>`;
      } else if (isCopyEvent) {
        actionsHtml =
          `<button type="button" class="secondary small" data-act="copyText">Copy</button>` +
          `<button type="button" class="secondary small" data-act="remove">Remove</button>`;
      } else {
        actionsHtml = `<button type="button" class="secondary small" data-act="remove">Remove</button>`;
      }

      html +=
        `<div class="history-item" data-id="${escapeHtml(id)}">` +
        `  <div class="history-row">` +
        `    <div class="history-meta">` +
        `      <div><strong>${escapeHtml(title)}</strong></div>` +
        `      <div style="opacity:.75;">${escapeHtml(time)}</div>` +
        `    </div>` +
        `    <div class="history-actions">${actionsHtml}</div>` +
        `  </div>` +
        `</div>`;
    }

    el.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function flashElText(el, text = "Copied!", ms = 1000) {
    if (!el) return;

    const stateKey = "__flashState";
    const st = el[stateKey] || { timer: null, prevText: null };
    el[stateKey] = st;

    if (st.timer) {
      clearTimeout(st.timer);
      st.timer = null;
    }

    if (st.prevText == null) st.prevText = el.textContent;
    el.textContent = text;
    el.classList?.add?.("flash");

    st.timer = window.setTimeout(() => {
      el.textContent = st.prevText ?? el.textContent;
      el.classList?.remove?.("flash");
      el[stateKey] = { timer: null, prevText: null };
    }, ms);
  }

  function add(item) {
    const items = load();

    // newest first
    items.unshift(item);

    // cap
    const trimmed = items.slice(0, MAX_ITEMS);
    save(trimmed);
    render();
  }

  function clearAll() {
    save([]);
    render();
    ctx.showToast?.("History cleared.", "success", 1800);
  }

  function removeById(id) {
    const items = load().filter((x) => x.id !== id);
    save(items);
    render();
  }

  function findById(id) {
    return load().find((x) => x.id === id) || null;
  }

  function restore(item) {
    if (!item) return;

    if (ctx.setSelectedType && item.type) ctx.setSelectedType(item.type);

    if (item.kind === "single") {
      ctx.setMode?.("single");
      ctx.setSingleUrl?.(item.url || "");
      ctx.setSingleFileName?.(item.fileName || "");
      ctx.updatePreview?.();
      ctx.showToast?.("Restored single URL from history.", "success", 1800);
      return;
    }

    if (item.kind === "batch") {
      ctx.setMode?.("batch");
      ctx.setBatchText?.((item.urls || []).join("\n"));
      if (typeof item.zipBaseName === "string") ctx.setZipName?.(item.zipBaseName);
      ctx.updatePreview?.();
      ctx.showToast?.("Restored batch from history.", "success", 1800);
      return;
    }
  }

  function wireEvents() {
    if (ctx.detailsEl) {
      ctx.detailsEl.open = loadHistoryOpen();
      ctx.detailsEl.addEventListener("toggle", () => {
        saveHistoryOpen(!!ctx.detailsEl.open);
      });
    }

    if (ctx.clearBtnEl) {
      ctx.clearBtnEl.addEventListener("click", clearAll);
    }

    if (ctx.historyListEl) {
      ctx.historyListEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-act]");
        const itemEl = e.target.closest(".history-item");
        if (!btn || !itemEl) return;

        const id = itemEl.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        const item = findById(id);

        if (act === "remove") {
          removeById(id);
          return;
        }

        if (act === "load" && item?.kind === "single") {
          ctx.setMode?.("single");
          if (ctx.setSelectedType && item.type) ctx.setSelectedType(item.type);
          ctx.setSingleUrl?.(item.url || "");
          ctx.setSingleFileName?.(item.fileName || "");
          ctx.updatePreview?.();
          ctx.showToast?.("Loaded single URL from history.", "success", 1600);
          return;
        }

        if (act === "restore") {
          restore(item);
          return;
        }

        if (act === "csv" && item?.kind === "batch") {
          restore(item);
          if (typeof ctx.downloadCsvNow === "function") return ctx.downloadCsvNow();
          ctx.showToast?.("CSV handler not wired.", "error", 2400);
          return;
        }

        if (act === "json" && item?.kind === "batch") {
          restore(item);
          if (typeof ctx.downloadJsonNow === "function") return ctx.downloadJsonNow();
          ctx.showToast?.("JSON handler not wired.", "error", 2400);
          return;
        }

        if (act === "open" && item?.kind === "single" && item.url) {
          const w = window.open(item.url, "_blank", "noopener,noreferrer");
          if (!w) ctx.showToast?.("Pop-up blocked. Allow pop-ups to open links.", "error", 3200);
          return;
        }

        if (act === "copy" && item?.kind === "single" && item.url) {
          try {
            await navigator.clipboard.writeText(item.url);
            flashElText(btn, "Copied!", 900);
            ctx.showToast?.("Copied URL from history.", "success", 1600);
          } catch {
            ctx.showToast?.("Clipboard blocked by browser.", "error", 2400);
          }
          return;
        }

        if (act === "download" && item?.kind === "single") {
          ctx.setMode?.("single");
          if (ctx.setSelectedType && item.type) ctx.setSelectedType(item.type);
          ctx.setSingleUrl?.(item.url || "");
          ctx.setSingleFileName?.(item.fileName || "");
          ctx.updatePreview?.();

          if (typeof ctx.downloadSingleNow === "function") return ctx.downloadSingleNow();
          ctx.showToast?.("Download handler not wired.", "error", 2400);
          return;
        }

        if (act === "zip" && item?.kind === "batch") {
          restore(item);
          if (typeof ctx.downloadZipNow === "function") return ctx.downloadZipNow();
          ctx.showToast?.("ZIP handler not wired.", "error", 2400);
          return;
        }

        if (act === "copyUrls" && item?.kind === "batch") {
          const text = Array.isArray(item.urls) ? item.urls.filter(Boolean).join("\n") + "\n" : "";
          if (!text.trim()) return;

          try {
            await navigator.clipboard.writeText(text);
            flashElText(btn, "Copied!", 900);
            ctx.showToast?.("Copied URL list from history.", "success", 1600);
          } catch {
            ctx.showToast?.("Clipboard blocked by browser.", "error", 2400);
          }
          return;
        }

        if (act === "copyText" && item?.kind === "event" && item.copyText) {
          try {
            await navigator.clipboard.writeText(item.copyText);
            flashElText(btn, "Copied!", 900);
            ctx.showToast?.("Copied from history.", "success", 1600);
          } catch {
            ctx.showToast?.("Clipboard blocked by browser.", "error", 2400);
          }
          return;
        }
      });
    }
  }

  function init(c) {
    ctx = { ...ctx, ...(c || {}) };
    wireEvents();
    render();
  }

  function makeId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    return String(Date.now()) + Math.random().toString(16).slice(2);
  }

  // public recording helpers
  function recordSingle({ url, type, source, label, fileName } = {}) {
    add({
      id: makeId(),
      kind: "single",
      createdAt: nowIso(),
      url: url || "",
      type: type || "html",
      source: source || "action",
      label: label || "",
      fileName: (fileName || "").trim(), // ✅ NEW
    });
  }

  function recordBatch({ urls, type, zipBaseName, source, label, replace, importedKind } = {}) {
    add({
      id: makeId(),
      kind: "batch",
      createdAt: nowIso(),
      urls: Array.isArray(urls) ? urls.slice(0, 5000) : [], // safety cap
      type: type || "html",
      zipBaseName: (zipBaseName || "").trim() || "links",
      source: source || "action",
      label: label || "",
      replace: typeof replace === "boolean" ? replace : undefined,
      importedKind: importedKind || "",
    });
  }

  function recordEvent(evt) {
    add({
      id: makeId(),
      kind: "event",
      createdAt: nowIso(),
      source: evt?.source || "event",
      label: evt?.label || "",
      details: evt?.details || "",
      copyText: typeof evt?.copyText === "string" ? evt.copyText : "",
    });
  }

  function sourceLabel(src) {
    const s = String(src || "").toLowerCase();
    if (s === "zip") return "ZIP";
    if (s === "csv") return "CSV";
    if (s === "json") return "JSON";
    if (s === "batchfile") return "BATCH FILE";
    if (s === "download") return "DOWNLOAD";
    if (s === "copy") return "COPY";
    if (s === "import") return "IMPORT";
    if (s === "reset") return "RESET";
    return s ? s.toUpperCase() : "ACTION";
  }

  window.App.history = {
    init,
    render,
    clearAll,
    recordSingle,
    recordBatch,
    recordEvent,
  };
})();
