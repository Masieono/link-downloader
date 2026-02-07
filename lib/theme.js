// lib/theme.js
(function () {
  window.App = window.App || {};

  const STORAGE_KEY = "lfg_theme_v1"; // "light" | "dark" | "system"
  const MQ = "(prefers-color-scheme: dark)";

  function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }

  function getSystemTheme() {
    try {
      return window.matchMedia && window.matchMedia(MQ).matches ? "dark" : "light";
    } catch {
      return "dark";
    }
  }

  function normalizePref(pref) {
    return pref === "light" || pref === "dark" || pref === "system" ? pref : "system";
  }

  function applyTheme(pref) {
    const root = document.documentElement;
    const p = normalizePref(pref);

    if (p === "system") {
      root.dataset.theme = getSystemTheme();
      root.dataset.themeSource = "system";
      return;
    }

    root.dataset.theme = p; // "light" | "dark"
    root.dataset.themeSource = "user";
  }

  function loadThemePref() {
    return normalizePref(safeGetItem(STORAGE_KEY));
  }

  function saveThemePref(pref) {
    safeSetItem(STORAGE_KEY, normalizePref(pref));
  }

  function effectiveTheme() {
    return document.documentElement.dataset.theme || getSystemTheme();
  }

  function setButtonLabel(btn, pref) {
    if (!btn) return;

    const p = normalizePref(pref);
    const label =
      p === "system"
        ? `Theme: System (${effectiveTheme()})`
        : `Theme: ${p[0].toUpperCase()}${p.slice(1)}`;

    const labelEl = btn.querySelector(".btn-label");
    if (labelEl) labelEl.textContent = label;
    else btn.textContent = label; // fallback
  }

  function cycle(pref) {
    const p = normalizePref(pref);
    // System -> Light -> Dark -> System
    if (p === "system") return "light";
    if (p === "light") return "dark";
    return "system";
  }

  function init({ toggleBtnEl } = {}) {
    const btn = toggleBtnEl || null;

    let pref = loadThemePref();
    applyTheme(pref);
    setButtonLabel(btn, pref);

    // React to system theme changes only when pref is "system"
    let mq = null;
    let handler = null;

    if (window.matchMedia) {
      mq = window.matchMedia(MQ);
      handler = () => {
        const currentPref = loadThemePref();
        if (currentPref === "system") {
          applyTheme("system");
          setButtonLabel(btn, "system");
        }
      };

      if (mq.addEventListener) mq.addEventListener("change", handler);
      else if (mq.addListener) mq.addListener(handler);
    }

    if (btn) {
      btn.addEventListener("click", () => {
        pref = cycle(pref);
        saveThemePref(pref);
        applyTheme(pref);
        setButtonLabel(btn, pref);
      });
    }

    // (Optional future) expose cleanup if you ever need it:
    // return () => { if (mq && handler) { ...removeListener... } };
  }

  window.App.theme = { init, applyTheme, getSystemTheme };
})();
