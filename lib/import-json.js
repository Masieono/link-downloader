// lib/import-json.js
(function () {
  window.App = window.App || {};

  function stripBom(s) {
    return typeof s === "string" ? s.replace(/^\uFEFF/, "") : s;
  }

  function safeJsonParse(text) {
    try {
      return { ok: true, value: JSON.parse(stripBom(text)) };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function asString(x) {
    if (x == null) return "";
    if (typeof x === "string") return x;
    return String(x);
  }

  // "URL-like" heuristic (import-files.js will do true normalization later)
  function looksUrlLike(value) {
    const s = String(value || "").trim();
    if (!s) return false;

    // strong signals
    if (/^https?:\/\//i.test(s)) return true;
    if (/^www\./i.test(s)) return true;

    // weak-but-useful domain-ish (avoid spaces)
    if (/[a-z0-9-]+\.[a-z]{2,}/i.test(s) && !/\s/.test(s)) return true;

    return false;
  }

  // -------------------------
  // Firefox (moz_places) helpers
  // -------------------------
  function isMozPlace(node) {
    return node && typeof node === "object" && (node.type === "text/x-moz-place" || node.typeCode === 1);
  }

  function isMozContainer(node) {
    return node && typeof node === "object" && (node.type === "text/x-moz-place-container" || node.typeCode === 2);
  }

  function collectMozPlaceUris(node, out) {
    if (!node || typeof node !== "object") return;

    if (isMozPlace(node) && typeof node.uri === "string") out.push(node.uri);

    if (Array.isArray(node.children)) {
      for (const c of node.children) collectMozPlaceUris(c, out);
    }
  }

  function findFirefoxToolbarFolder(rootObj) {
    const stack = [rootObj];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;

      if (
        isMozContainer(node) &&
        (node.root === "toolbarFolder" || node.guid === "toolbar_____" || node.title === "toolbar")
      ) {
        return node;
      }

      if (Array.isArray(node.children)) {
        for (const c of node.children) stack.push(c);
      }
    }
    return null;
  }

  function looksLikeFirefoxBookmarksObject(obj) {
    if (!obj || typeof obj !== "object") return false;
    return (
      obj.type === "text/x-moz-place-container" ||
      obj.type === "text/x-moz-place" ||
      typeof obj.guid === "string" ||
      typeof obj.root === "string" ||
      Array.isArray(obj.children)
    );
  }

  // -------------------------
  // Chrome "Bookmarks" file helpers (profile JSON)
  // -------------------------
  function looksLikeChromeBookmarksFile(obj) {
    return !!(obj && typeof obj === "object" && obj.roots && typeof obj.roots === "object");
  }

  function collectChromeBookmarkUrls(node, out) {
    if (!node || typeof node !== "object") return;

    if (typeof node.url === "string") out.push(node.url);

    if (Array.isArray(node.children)) {
      for (const c of node.children) collectChromeBookmarkUrls(c, out);
    }
  }

  function extractChromeBookmarks(obj) {
    const out = [];
    if (!looksLikeChromeBookmarksFile(obj)) return out;

    const roots = obj.roots || {};
    const candidates = [roots.bookmark_bar, roots.other, roots.synced].filter(Boolean);

    for (const root of candidates) collectChromeBookmarkUrls(root, out);
    return out;
  }

  // -------------------------
  // Generic schema-aware extraction
  // -------------------------
  const URL_KEYS = [
    "url",
    "uri",
    "href",
    "link",
    "website",
    "web",
    // removed "source" (collides with your own metadata fields)
    "target",
    "address",
  ];

  const LIST_KEYS = [
    "urls",
    "links",
    "bookmarks",
    "items",
    "entries",
    "records",
    "results",
    // keep "data" last because it's very generic
    "data",
  ];

  function extractUrlFromObject(obj) {
    if (!obj || typeof obj !== "object") return null;

    // Build a case-insensitive map only once
    const lowerMap = {};
    for (const k of Object.keys(obj)) lowerMap[k.toLowerCase()] = k;

    for (const key of URL_KEYS) {
      const realKey = lowerMap[key];
      if (!realKey) continue;

      const v = obj[realKey];
      if (typeof v === "string" && looksUrlLike(v)) return v;
    }

    // legacy: raw might be a URL
    if (typeof obj.raw === "string" && looksUrlLike(obj.raw)) return obj.raw;

    return null;
  }

  function extractUrlsFromArrayOfObjects(arr) {
    const urls = [];
    for (const item of arr || []) {
      if (!item) continue;

      if (typeof item === "object") {
        const direct = extractUrlFromObject(item);
        if (direct) urls.push(direct);
        continue;
      }

      const s = asString(item).trim();
      if (looksUrlLike(s)) urls.push(s);
    }
    return urls;
  }

  function extractFromListKeys(obj) {
    if (!obj || typeof obj !== "object") return null;

    const keys = Object.keys(obj);

    for (const k of LIST_KEYS) {
      // exact
      if (Array.isArray(obj[k])) return obj[k];

      // case-insensitive
      const realKey = keys.find((x) => x.toLowerCase() === k);
      if (realKey && Array.isArray(obj[realKey])) return obj[realKey];
    }

    return null;
  }

  /**
   * JSON import supports:
   * 1) batch file object -> requires opts.isValidBatchFileObject
   * 2) Firefox bookmarks JSON (prefers toolbarFolder)
   * 3) Chrome bookmarks JSON file
   * 4) export rows array or generic array-of-objects with url-ish keys
   * 5) url list array
   * 6) object with .urls/.links/.items/etc arrays
   */
  function parse(jsonText, opts = {}) {
    const parsed = safeJsonParse(jsonText);
    if (!parsed.ok) return { kind: "invalidJson", error: parsed.error };

    const obj = parsed.value;

    // 1) Batch file
    if (typeof opts.isValidBatchFileObject === "function" && opts.isValidBatchFileObject(obj)) {
      return { kind: "batch", batchObj: obj };
    }

    // 2) Firefox bookmarks JSON
    if (looksLikeFirefoxBookmarksObject(obj)) {
      const toolbar = findFirefoxToolbarFolder(obj);

      if (toolbar) {
        const out = [];
        collectMozPlaceUris(toolbar, out);
        if (out.length) return { kind: "urls", urls: out };
      }

      const out = [];
      collectMozPlaceUris(obj, out);
      if (out.length) return { kind: "urls", urls: out };
    }

    // 3) Chrome bookmarks file JSON
    if (looksLikeChromeBookmarksFile(obj)) {
      const urls = extractChromeBookmarks(obj);
      if (urls.length) return { kind: "urls", urls };
    }

    // 4/5) Array
    if (Array.isArray(obj)) {
      // array of objects -> schema-aware
      if (obj.length && typeof obj[0] === "object" && obj[0] !== null) {
        const urls = extractUrlsFromArrayOfObjects(obj).filter(Boolean);
        return { kind: "urls", urls };
      }

      // array of primitives -> treat as URL-ish list
      const urls = obj
        .map((x) => asString(x).trim())
        .filter((s) => looksUrlLike(s));
      return { kind: "urls", urls };
    }

    // 6) Object containing arrays (urls/links/items/etc)
    if (obj && typeof obj === "object") {
      const list = extractFromListKeys(obj);
      if (Array.isArray(list)) {
        if (list.length && typeof list[0] === "object" && list[0] !== null) {
          const urls = extractUrlsFromArrayOfObjects(list).filter(Boolean);
          return { kind: "urls", urls };
        }

        const urls = list
          .map((x) => asString(x).trim())
          .filter((s) => looksUrlLike(s));
        return { kind: "urls", urls };
      }

      // As a last resort: single object might itself contain a URL-ish field
      const single = extractUrlFromObject(obj);
      if (single) return { kind: "urls", urls: [single] };
    }

    return { kind: "unknown" };
  }

  window.App.importJson = { parse };
})();
