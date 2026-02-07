// lib/qr.js
(function () {
  window.App = window.App || {};

  // -------------------------
  // Assertions + tiny helpers
  // -------------------------

  function assertQrLibLoaded() {
    if (typeof window.qrcode !== "function") {
      throw new Error(
        "QR library not loaded. Expected global function `qrcode(...)`. " +
          "Make sure the Arase qrcode.js is included BEFORE lib/qr.js."
      );
    }
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function resolveScale(scale) {
    // numeric passes through
    const n = parseInt(scale, 10);
    if (Number.isFinite(n)) return n;

    // named sizes (match your UI if it uses these)
    const s = String(scale || "").toLowerCase();
    if (s === "small") return 6;
    if (s === "medium") return 8;
    if (s === "large") return 10;
    if (s === "xl" || s === "xlarge") return 12;

    return 8;
  }

  // Escape for XML attribute values (prevents SVG attribute injection)
  function escAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Ensure folder is a safe relative path prefix like "qr/"
  function normalizeFolder(folder) {
    let f = String(folder || "qr/");

    // prevent absolute paths / traversal
    f = f.replace(/^[\/\\]+/g, "");
    f = f.replace(/\.\.(?:[\/\\]|$)/g, "");
    f = f.replace(/[\\]+/g, "/");

    if (!f.endsWith("/")) f += "/";
    return f;
  }

  // Ensure filename base can't contain path separators etc.
  function sanitizeBaseName(base) {
    let b = String(base || "link");
    b = b.replace(/[\/\\]/g, "_");
    b = b.replace(/[^a-z0-9._-]/gi, "_");
    b = b.replace(/_+/g, "_");
    b = b.replace(/[. ]+$/g, "");
    b = b.slice(0, 200);
    return b || "link";
  }

  // -------------------------
  // URL sanitization
  // -------------------------

  // Safety: only allow http/https URLs to be encoded
  // Also: accept bare domains like "example.com" by reusing App.url.normalizeUrl when available.
  function sanitizeToHttpUrl(urlStr) {
    const raw = String(urlStr || "").trim();
    if (!raw) return { ok: false, reason: "Empty URL." };

    // Prefer your app’s normalizer (adds https:// when missing)
    if (window.App?.url?.normalizeUrl) {
      const n = window.App.url.normalizeUrl(raw);
      if (!n.ok) return { ok: false, reason: n.reason || "Invalid URL." };
      try {
        const u = new URL(n.url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return { ok: false, reason: "Only http(s) URLs can be encoded." };
        }
        return { ok: true, url: u.toString() };
      } catch {
        return { ok: false, reason: "Invalid URL." };
      }
    }

    // Fallback (if App.url.normalizeUrl ever not present)
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, reason: "Only http(s) URLs can be encoded." };
      }
      return { ok: true, url: u.toString() };
    } catch {
      return { ok: false, reason: "Invalid URL." };
    }
  }

  // -------------------------
  // QR core
  // -------------------------

  /**
   * Build a QR object for a URL.
   * opts:
   *  - ecc: "L" | "M" | "Q" | "H"  (default M)
   *  - typeNumber: 0 for auto (default 0)
   */
  function makeQr(urlStr, opts = {}) {
    assertQrLibLoaded();

    const ecc = String(opts.ecc || "M").toUpperCase();
    const ecLevel = ["L", "M", "Q", "H"].includes(ecc) ? ecc : "M";
    const typeNumber = Number.isFinite(opts.typeNumber) ? opts.typeNumber : 0;

    const qr = window.qrcode(typeNumber, ecLevel);
    qr.addData(String(urlStr));
    qr.make();
    return qr;
  }

  /**
   * Produce a boolean matrix [y][x] => dark?
   */
  function getMatrix(qr) {
    const count = qr.getModuleCount();
    const m = new Array(count);
    for (let y = 0; y < count; y++) {
      const row = new Array(count);
      for (let x = 0; x < count; x++) {
        row[x] = !!qr.isDark(y, x);
      }
      m[y] = row;
    }
    return { size: count, matrix: m };
  }

  // -------------------------
  // SVG
  // -------------------------

  /**
   * Build SVG string from QR.
   * opts:
   *  - margin: modules of quiet zone (default 4)
   *  - scale: pixels per module (default 8) (only affects width/height attrs)
   *  - background, foreground, transparent
   *  - ecc, typeNumber forwarded
   */
  function buildSvgForUrl(urlStr, opts = {}) {
    const s = sanitizeToHttpUrl(urlStr);
    if (!s.ok) return { ok: false, reason: s.reason, svg: "" };

    const m = parseInt(opts.margin ?? 4, 10);
    const margin = clamp(Number.isFinite(m) ? m : 4, 0, 32);

    const scale = clamp(resolveScale(opts.scale ?? 8), 1, 64);

    const qr = makeQr(s.url, opts);
    const { size, matrix } = getMatrix(qr);

    const total = size + margin * 2;

    const background = escAttr(opts.background || "#fff");
    const foreground = escAttr(opts.foreground || "#000");
    const transparent = !!opts.transparent;

    let rects = "";
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!matrix[y][x]) continue;
        rects += `<rect x="${x + margin}" y="${y + margin}" width="1" height="1" />`;
      }
    }

    const bgRect = transparent
      ? ""
      : `<rect width="100%" height="100%" fill="${background}"/>`;

    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${total * scale}" height="${total * scale}" ` +
      `viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
      bgRect +
      `<g fill="${foreground}">${rects}</g>` +
      `</svg>\n`;

    return { ok: true, url: s.url, svg };
  }

  // -------------------------
  // PNG (Canvas)
  // -------------------------

  /**
   * Render QR to a Canvas and return a PNG Blob.
   * opts:
   *  - margin, scale, background, foreground, transparent
   *  - ecc, typeNumber forwarded
   */
  async function buildPngBlobForUrl(urlStr, opts = {}) {
    const s = sanitizeToHttpUrl(urlStr);
    if (!s.ok) return { ok: false, reason: s.reason, blob: null };

    const m = parseInt(opts.margin ?? 4, 10);
    const margin = clamp(Number.isFinite(m) ? m : 4, 0, 32);

    const scale = clamp(resolveScale(opts.scale ?? 8), 1, 64);

    const background = String(opts.background || "#fff");
    const foreground = String(opts.foreground || "#000");
    const transparent = !!opts.transparent;

    const qr = makeQr(s.url, opts);
    const { size, matrix } = getMatrix(qr);

    const total = size + margin * 2;
    const px = total * scale;

    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;

    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, reason: "Canvas not supported.", blob: null };

    if (transparent) ctx.clearRect(0, 0, px, px);
    else {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, px, px);
    }

    ctx.fillStyle = foreground;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!matrix[y][x]) continue;
        ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      }
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return { ok: false, reason: "Failed to render PNG.", blob: null };

    return { ok: true, url: s.url, blob };
  }

  // -------------------------
  // Batch ZIP entries
  // -------------------------

  /**
   * Build ZIP file entries for batch mode.
   * Returns array of { name, blobOrText, type } where type is "blob"|"text"
   */
  async function buildBatchQrFiles(urlItems, opts = {}) {
    const includePng = !!opts.includePng;
    const includeSvg = !!opts.includeSvg;
    const folder = normalizeFolder(opts.folder || "qr/");

    // Supports:
    //  - opts.render = { foreground, background, transparent }
    //  - legacy callers that pass those at top-level
    const renderBase = (opts && typeof opts.render === "object" && opts.render) ? opts.render : opts;

    const renderOpts = {
      margin: opts.margin,
      scale: opts.scale,
      ecc: opts.ecc,
      typeNumber: opts.typeNumber,

      foreground: renderBase.foreground,
      background: renderBase.background,
      transparent: renderBase.transparent,
    };

    const filenameFrom =
      typeof opts.filenameFrom === "function"
        ? opts.filenameFrom
        : (item, idx) => {
            try {
              const u = new URL(item?.url || "");
              const host = (u.hostname || "link").replace(/^www\./i, "");
              let tail = (u.pathname || "").replace(/\//g, "_").replace(/[^a-z0-9._-]/gi, "");
              if (!tail || tail === "_") tail = "root";
              return `${host}_${tail}_${idx + 1}`;
            } catch {
              return `link_${idx + 1}`;
            }
          };

    const out = [];

    for (let i = 0; i < (urlItems || []).length; i++) {
      const item = urlItems[i] || {};
      const base = sanitizeBaseName(filenameFrom(item, i) || `link_${i + 1}`);

      if (includeSvg) {
        const sv = buildSvgForUrl(item.url, renderOpts);
        if (sv.ok) out.push({ type: "text", name: `${folder}${base}.svg`, blobOrText: sv.svg });
      }

      if (includePng) {
        const pn = await buildPngBlobForUrl(item.url, renderOpts);
        if (pn.ok && pn.blob) out.push({ type: "blob", name: `${folder}${base}.png`, blobOrText: pn.blob });
      }
    }

    return out;
  }

  window.App.qr = {
    buildSvgForUrl,
    buildPngBlobForUrl,
    buildBatchQrFiles,
  };
})();
