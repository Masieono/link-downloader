// lib/output-builders.js
(function () {
  window.App = window.App || {};

  // -------------------------
  // URL safety helpers
  // - Reject control characters (CR/LF/TAB/etc) to avoid header / file injection.
  // - Ensure only http/https URLs get through.
  // -------------------------

  function containsRealControlChars(s) {
    // Includes \r \n \t and other control chars + DEL
    return /[\u0000-\u001F\u007F]/.test(String(s || ""));
  }

  function toSafeHttpUrl(raw) {
    const s = String(raw || "").trim();

    // Reject empty or any control chars
    if (!s || containsRealControlChars(s)) return "";

    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";

      const out = u.toString();

      // Paranoia: ensure normalized output also has no control chars
      if (containsRealControlChars(out)) return "";
      return out;
    } catch {
      return "";
    }
  }

  // -------------------------
  // Escaping helpers
  // -------------------------

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escXml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // -------------------------
  // Builders
  // -------------------------

  function buildHtmlRedirectFile(urlStr) {
    const safeUrl = toSafeHttpUrl(urlStr);

    // Lock down the page. No scripts.
    const csp =
      "default-src 'none'; " +
      "style-src 'unsafe-inline'; " +
      "img-src data:; " +
      "base-uri 'none'; " +
      "form-action 'none'; " +
      "frame-ancestors 'none'";

    if (!safeUrl) {
      return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="${escHtml(csp)}">
  <title>Invalid link</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 18px; line-height: 1.4; }
    .card { max-width: 720px; border: 1px solid rgba(127,127,127,0.35); border-radius: 12px; padding: 14px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 10px;">Invalid link</h2>
    <p>This redirect file did not contain a valid <code>http(s)</code> URL.</p>
  </div>
</body>
</html>`;
    }

    const shown = escHtml(safeUrl);

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${shown}">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="${escHtml(csp)}">
  <title>Opening link...</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 18px; line-height: 1.4; }
    .card { max-width: 720px; border: 1px solid rgba(127,127,127,0.35); border-radius: 12px; padding: 14px; }
    a { word-break: break-word; }
    .muted { opacity: 0.75; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <p><strong>Opening:</strong> <a href="${shown}" rel="noopener noreferrer">${shown}</a></p>
    <p class="muted">If you are not redirected automatically, click the link above.</p>
  </div>
</body>
</html>`;
  }

  function buildWindowsUrlFile(urlStr) {
    const safeUrl = toSafeHttpUrl(urlStr);

    // Produce a harmless shortcut file if invalid
    if (!safeUrl) {
      return `[InternetShortcut]
URL=
`;
    }

    // Important: no indentation, no leading spaces
    return `[InternetShortcut]
URL=${safeUrl}
`;
  }

  function buildMacWeblocFile(urlStr) {
    const safeUrl = toSafeHttpUrl(urlStr);

    // If invalid, keep it empty but well-formed
    const escaped = escXml(safeUrl || "");

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>URL</key>
    <string>${escaped}</string>
  </dict>
</plist>
`;
  }

  // -------------------------
  // Dispatcher
  // -------------------------

  function buildFileContents(urlStr, type) {
    if (type === "html") {
      return { contents: buildHtmlRedirectFile(urlStr), mime: "text/html;charset=utf-8" };
    }
    if (type === "url") {
      return { contents: buildWindowsUrlFile(urlStr), mime: "text/plain;charset=utf-8" };
    }
    if (type === "webloc") {
      return { contents: buildMacWeblocFile(urlStr), mime: "application/xml;charset=utf-8" };
    }
    return null;
  }

  window.App.outputBuilders = {
    // (optional export but useful)
    toSafeHttpUrl,

    buildHtmlRedirectFile,
    buildWindowsUrlFile,
    buildMacWeblocFile,
    buildFileContents,
  };
})();
