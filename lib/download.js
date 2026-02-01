// lib/download.js
(function () {
  window.App = window.App || {};

  // Revoke a bit later to avoid canceling downloads in slower browsers.
  const REVOKE_DELAY_MS = 2000;

  function safeFileName(name, fallback = "download") {
    const s = String(name ?? "").trim();
    return s || fallback;
  }

  /**
   * Trigger a browser download for a Blob.
   * - filename: suggested download name (string)
   * - blob: Blob instance (required)
   */
  function downloadBlob(filename, blob) {
    if (!(blob instanceof Blob)) {
      // Allow callers to pass e.g. Uint8Array/string by mistake and get a clear message.
      throw new Error("downloadBlob: blob must be a Blob");
    }

    const safeName = safeFileName(filename);

    const objectUrl = URL.createObjectURL(blob);

    try {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = safeName;

      // noopener is harmless; noreferrer can break some download flows in older browsers,
      // so we keep just noopener.
      a.rel = "noopener";

      // Some browsers require it to be in the DOM to trigger the click.
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      // Revoke later to avoid canceling download in slow browsers.
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      }, REVOKE_DELAY_MS);
    }
  }

  window.App.download = { downloadBlob };
})();
