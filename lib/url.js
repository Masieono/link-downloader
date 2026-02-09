// lib/url.js
(function () {
  window.App = window.App || {};

  // -------------------------
  // URL normalization/validation
  // -------------------------

  function normalizeUrl(raw) {
    let s = String(raw || "").trim();
    if (!s) return { ok: false, reason: "Please enter a URL." };

    // Common paste cleanup: <https://example.com> or "https://example.com"
    s = s.replace(/^[<"'`]+/, "").replace(/[>"'`]+$/, "").trim();

    // If user typed "example.com", add https://
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
      s = "https://" + s;
    }

    let u;
    try {
      u = new URL(s);
    } catch {
      return { ok: false, reason: "That does not look like a valid URL." };
    }

    if (!["http:", "https:"].includes(u.protocol)) {
      return { ok: false, reason: "Only http:// and https:// URLs are supported." };
    }

    // Canonicalize (safe, non-destructive)
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();

    // Require a plausible host when user omitted the scheme (prevents "foo" => https://foo)
    // Allow: example.com, www.example.com, localhost, IPv4, IPv6
    const host = u.hostname;

    const isLocalhost = host === "localhost";
    const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const isIPv6 = host.includes(":"); // URL() normalizes IPv6 without brackets in hostname
    const hasDot = host.includes(".");

    if (!(isLocalhost || isIPv4 || isIPv6 || hasDot)) {
      return { ok: false, reason: "That does not look like a valid URL." };
    }

    // Remove default ports
    if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
      u.port = "";
    }

    return { ok: true, url: u.toString() };
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // -------------------------
  // URL mode helpers
  // -------------------------

  function stripAllQuery(urlStr) {
    try {
      const u = new URL(urlStr);
      u.search = "";
      u.hash = ""; // optional: also remove fragment (usually desired for “same page” links)
      return u.toString();
    } catch {
      return urlStr;
    }
  }

  function stripTrackingOnly(urlStr) {
    try {
      const u = new URL(urlStr);

      // common tracking params (add more later if desired)
      const exact = new Set([
        "fbclid",
        "gclid",
        "dclid",
        "msclkid",
        "igshid",
        "mc_cid",
        "mc_eid",
      ]);

      const remove = [];
      u.searchParams.forEach((value, key) => {
        const k = key.toLowerCase();
        if (k.startsWith("utm_")) remove.push(key);
        else if (exact.has(k)) remove.push(key);
      });

      remove.forEach((k) => u.searchParams.delete(k));

      // keep hash as-is for tracking-only mode (generally fine)
      return u.toString();
    } catch {
      return urlStr;
    }
  }

  function applyUrlMode(urlStr, mode) {
    const m = String(mode || "full");
    if (m === "stripAll") return stripAllQuery(urlStr);
    if (m === "stripTracking") return stripTrackingOnly(urlStr);
    return urlStr; // full
  }

  // -------------------------
  // Filename utilities
  // -------------------------

  function safeBaseNameFromUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      let host = (u.hostname || "").toLowerCase();

      if (host.startsWith("www.")) host = host.slice(4);

      const parts = host.split(".").filter(Boolean);

      // base from host (drop TLD only)
      let base = parts.length >= 2 ? parts.slice(0, -1).join(".") : (parts[0] || "");

      // If base is empty or very generic, use first meaningful path segment
      if (!base || base === "google" || base === "github" || base === "microsoft") {
        const seg = (u.pathname || "")
          .split("/")
          .map((x) => x.trim())
          .filter(Boolean)[0];
        if (seg) base = `${base || "link"}-${seg}`;
      }

      return base || "link";
    } catch {
      return "link";
    }
  }

  function getExtensionForType(type) {
    const t = String(type || "").toLowerCase();
    if (t === "url") return "url";
    if (t === "webloc") return "webloc";
    return "html";
  }

  function ensureExtension(name, ext) {
    const trimmed = String(name || "").trim();
    const e = String(ext || "").trim().replace(/^\./, "");
    if (!trimmed || !e) return trimmed;

    // Case-insensitive check
    const re = new RegExp(`\\.${escapeRegExp(e)}$`, "i");
    if (re.test(trimmed)) return trimmed;

    return `${trimmed}.${e}`;
  }

  function makeUniqueFilename(name, usedNames) {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    const dot = name.lastIndexOf(".");
    const base = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : "";
    let i = 2;
    while (usedNames.has(`${base}-${i}${ext}`)) i++;
    const unique = `${base}-${i}${ext}`;
    usedNames.add(unique);
    return unique;
  }

  // -------------------------
  // Filename sanitization
  // -------------------------

  // Windows device names (reserved), case-insensitive, with or without extension
  const WINDOWS_RESERVED = new Set([
    "con","prn","aux","nul",
    "com1","com2","com3","com4","com5","com6","com7","com8","com9",
    "lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9",
  ]);

  function sanitizeFilename(name, opts) {
    const options = opts || {};
    const fallback = (options.fallback || "link").trim() || "link";
    const maxLength = Number.isFinite(options.maxLength) ? options.maxLength : 160;

    let s = String(name ?? "").trim();

    // Unicode normalize (helps avoid weird “lookalike” forms)
    try {
      s = s.normalize("NFKC");
    } catch {
      // ignore if not supported
    }

    // Replace path separators + illegal Windows filename chars
    // Also strip control chars (0x00-0x1F, 0x7F)
    s = s
      .replace(/[\/\\]/g, "-")
      .replace(/[<>:"|?*]/g, "-")
      .replace(/[\u0000-\u001F\u007F]/g, "");

    // Collapse whitespace
    s = s.replace(/\s+/g, " ").trim();

    // Avoid odd sequences like "..." or " -- "
    s = s.replace(/[.]{2,}/g, ".").replace(/[-]{2,}/g, "-").trim();

    // Windows forbids trailing space or trailing dot
    s = s.replace(/[. ]+$/g, "");

    // If empty, fallback
    if (!s) s = fallback;

    // If reserved device name (ignoring extension), prefix underscore
    const dot = s.lastIndexOf(".");
    const base = dot >= 0 ? s.slice(0, dot) : s;
    const ext = dot >= 0 ? s.slice(dot) : "";
    if (WINDOWS_RESERVED.has(base.toLowerCase())) {
      s = "_" + base + ext;
    }

    // Length cap (keep extension if present)
    if (s.length > maxLength) {
      const d = s.lastIndexOf(".");
      if (d > 0 && s.length - d <= 10) {
        const e = s.slice(d);
        const b = s.slice(0, d);
        const keep = Math.max(1, maxLength - e.length);
        s = b.slice(0, keep).replace(/[. ]+$/g, "") + e;
      } else {
        s = s.slice(0, maxLength).replace(/[. ]+$/g, "");
      }
    }

    // Final safety
    if (!s) s = fallback;

    return s;
  }

  function ensureSafeFilename(name, ext, opts) {
    const withExt = ensureExtension(name, ext);
    const cleaned = sanitizeFilename(withExt, opts);

    // After sanitization, extension could theoretically be lost (edge cases).
    // Enforce again.
    return ensureExtension(cleaned, ext);
  }

  window.App.url = {
    normalizeUrl,
    applyUrlMode,
    stripAllQuery,
    stripTrackingOnly,
    safeBaseNameFromUrl,
    ensureExtension,
    getExtensionForType,
    makeUniqueFilename,
    sanitizeFilename,
    ensureSafeFilename,
  };
})();
