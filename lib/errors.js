// lib/errors.js
(function () {
  window.App = window.App || {};

  // -------------------------
  // Normalization
  // -------------------------

  function normalizeError(err) {
    // Always return a predictable structure.
    if (!err) return { message: "Unknown error", details: "" };

    if (typeof err === "string") return { message: err, details: "" };

    // Prefer explicit fields; avoid "[object Object]" when possible.
    let message =
      err.message ??
      err.reason ??
      (typeof err.toString === "function" ? err.toString() : "") ??
      "Unknown error";

    message = String(message);

    // Include stack if available (devtools), and also show cause if present.
    let details = "";
    try {
      if (err.stack) details = String(err.stack);
      else if (err.cause) details = `Cause: ${String(err.cause)}`;

      // If it's a plain object without stack, capture something helpful.
      if (!details && typeof err === "object") {
        try {
          const json = JSON.stringify(err, null, 2);
          if (json && json !== "{}") details = json;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    return { message, details };
  }

  // -------------------------
  // Presentation
  // -------------------------

  function show(ui, title, err, opts = {}) {

    /*
    * Show a user-friendly toast.
    * - ui: App.ui (or compatible)
    * - title: short, friendly prefix
    * - err: any error
    * - opts:
    *    - details: boolean (if true and details exist, toast adds "(see console)")
    *    - durationMs: number (override toast duration)
    */

    const { message, details } = normalizeError(err);

    const prefix = title ? `${title}: ` : "";
    const hint = opts.details && details ? " (see console)" : "";
    const text = `${prefix}${message}${hint}`.trim();

    const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : 3600;
    ui?.showToast?.(text, "error", durationMs);

    // Always log full error details for devtools
    try {
      // eslint-disable-next-line no-console
      console.error(title || "Error", err);
      if (details && typeof details === "string") {
        // eslint-disable-next-line no-console
        console.error("Details:", details);
      }
    } catch {
      // ignore
    }
  }

  // -------------------------
  // Public API
  // -------------------------

  window.App.errors = {
    normalizeError,
    show,
  };
})();
