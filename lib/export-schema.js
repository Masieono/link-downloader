// lib/export-schema.js
(function () {
  window.App = window.App || {};

  const STORAGE_KEY = "lfg_export_fields_v1";
  const SCHEMA_OPEN_KEY = "lfg_export_schema_open_v1";

  // Field definitions (order here is the default “available” order)
  const FIELD_DEFS = [
    { key: "raw", label: "Raw input", desc: "Exactly what you pasted or imported, unchanged." },
    { key: "effectiveUrl", label: "URL (effective)", desc: "The URL that will actually be used after applying your URL mode settings." },
    { key: "normalizedUrl", label: "URL (normalized)", desc: "A cleaned, standardized version of the URL used for deduping and consistency." },
    { key: "filename", label: "Filename", desc: "The filename generated for this link (based on the URL and your settings)." },
    { key: "type", label: "File type", desc: "The link file format that will be generated (HTML, .url, or .webloc)." },

    // “value add” fields
    { key: "host", label: "Host", desc: "The domain name of the URL (for example, example.com)." },
    { key: "path", label: "Path", desc: "The portion of the URL after the domain, excluding query parameters." },
    { key: "query", label: "Query", desc: "The query string portion of the URL (everything after ?)." },
    { key: "dedupeKey", label: "Dedupe key", desc: "The internal value used to determine whether two URLs are considered duplicates." },
    { key: "source", label: "Source", desc: "Where this URL came from (manual entry, import, history, etc.)." },
  ];

  const KEY_SET = new Set(FIELD_DEFS.map((f) => f.key));
  const DEFAULT_FIELDS = ["raw", "effectiveUrl", "filename", "type"];

  let ctx = {
    selectedListEl: null,    // <ul>
    availableListEl: null,   // <div> with checkboxes
    onChange: null,
  };

  let selected = null; // array of keys in chosen order

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      
      // keep only known keys
      const cleaned = arr.filter((k) => KEY_SET.has(k));
      return cleaned.length ? cleaned : null;
    } catch {
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selected || []));
    } catch {
      // ignore
    }
  }

  function defaultSelected() {
    return DEFAULT_FIELDS.slice();
  }

  function clearStorage() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    try { localStorage.removeItem(SCHEMA_OPEN_KEY); } catch {}
  }

  function resetToDefaults() {
    // This will save defaults + rerender + fire onChange
    setFields(defaultSelected());
  }

  function updateSummaryLabel() {
    try {
      const el = document.getElementById("exportSchemaSummaryText");
      if (!el) return;

      const cur = getFields();        // ensures selected is initialized
      const def = DEFAULT_FIELDS;     // single source of truth

      const same =
        cur.length === def.length &&
        cur.every((k, i) => k === def[i]);

      el.textContent = same ? "Defaults" : "Custom";
    } catch {}
  }

  function getFields() {
    if (!Array.isArray(selected) || selected.length === 0) {
      selected = load() || defaultSelected();
    }
    return selected.slice();
  }

  function setFields(arr) {
    const cleaned = (arr || []).filter((k) => KEY_SET.has(k));
    selected = cleaned.length ? cleaned : defaultSelected();
    save();
    render();
    updateSummaryLabel();
    ctx.onChange?.(getFields());
  }

  function render() {
    if (!ctx.selectedListEl || !ctx.availableListEl) return;

    const current = new Set(getFields());

    // Render selected list (draggable)
    ctx.selectedListEl.innerHTML = getFields()
      .map((k) => {
        const def = FIELD_DEFS.find((f) => f.key === k);
        const label = def ? def.label : k;
        return `
<li class="schema-item" draggable="true" data-key="${k}">
  <span class="schema-handle" aria-hidden="true">☰</span>
  <span class="schema-label">${escapeHtml(label)}</span>
  <button type="button" class="secondary small danger schema-remove" data-remove="${k}">Remove</button>
</li>`;
      })
      .join("");

    // Render available checkboxes (with descriptions)
    ctx.availableListEl.innerHTML = FIELD_DEFS.map((f) => {
      const checked = current.has(f.key) ? "checked" : "";
      const descId = `schema-desc-${f.key}`;
      const hasDesc = !!(f.desc && String(f.desc).trim());

      return `
<label class="option schema-option">
  <input
    type="checkbox"
    data-field="${f.key}"
    ${checked}
    ${hasDesc ? `aria-describedby="${descId}"` : ""}
  />
  <span class="schema-opt-text">
    <span class="schema-opt-title">${escapeHtml(f.label)}</span>
    ${
      hasDesc
        ? `<span id="${descId}" class="schema-opt-desc">${escapeHtml(f.desc)}</span>`
        : ""
    }
  </span>
</label>`;
    }).join("");

    wireSelectedListDnD();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---- Selected list interactions ----

  let dragKey = null;

  function wireSelectedListDnD() {
    const ul = ctx.selectedListEl;
    if (!ul) return;

    // -------------------------
    // Remove buttons (wire fresh each render)
    // -------------------------
    ul.querySelectorAll("button[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-remove");
        const next = getFields().filter((x) => x !== k);
        setFields(next);
      });
    });

    // -------------------------
    // DnD wiring (ONLY ONCE per UL)
    // -------------------------
    if (ul.__schemaDndWired) return;
    ul.__schemaDndWired = true;

    const indicator = document.createElement("li");
    indicator.className = "schema-drop-indicator";
    indicator.setAttribute("aria-hidden", "true");

    let dropIndex = null;
    let isDragging = false;

    function getItemsNoIndicator() {
      return Array.from(ul.querySelectorAll(".schema-item"));
    }

    function clearIndicator() {
      dropIndex = null;
      if (indicator.parentNode) indicator.parentNode.removeChild(indicator);
    }

    function showIndicatorAt(index) {
      const items = getItemsNoIndicator();
      const clamped = Math.max(0, Math.min(items.length, index));
      dropIndex = clamped;

      if (indicator.parentNode !== ul) ul.appendChild(indicator);

      const beforeEl = items[clamped] || null;
      if (beforeEl) ul.insertBefore(indicator, beforeEl);
      else ul.appendChild(indicator);
    }

    function computeIndexFromPointer(clientY) {
      const items = getItemsNoIndicator();
      if (!items.length) return 0;

      const firstRect = items[0].getBoundingClientRect();
      const lastRect = items[items.length - 1].getBoundingClientRect();

      if (clientY < firstRect.top) return 0;
      if (clientY > lastRect.bottom) return items.length;

      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        const mid = r.top + r.height / 2;
        if (clientY < mid) return i;
      }
      return items.length;
    }

    function pinIndexIfOutsideUl(clientY) {
      const r = ul.getBoundingClientRect();
      const items = getItemsNoIndicator();

      if (clientY < r.top) return 0;
      if (clientY > r.bottom) return items.length;
      return null; // inside bounds
    }

    function commitReorder(insertAtRaw) {
      if (!dragKey) return false;

      const arr = getFields();
      const from = arr.indexOf(dragKey);
      if (from < 0) return false;

      // Remove dragged item
      arr.splice(from, 1);

      // Adjust insertion index if removal shifts indices
      let insertAt = insertAtRaw;
      if (from < insertAt) insertAt -= 1;

      // Clamp and insert
      insertAt = Math.max(0, Math.min(arr.length, insertAt));
      arr.splice(insertAt, 0, dragKey);

      clearIndicator();
      setFields(arr);
      return true;
    }

    // While dragging, we accept drops ANYWHERE on the document so Safari/Chrome will fire drop.
    function onDocDragOver(e) {
      if (!isDragging || !dragKey) return;

      // This is the key: without this, many "outside list" drops won't work.
      e.preventDefault();

      // Keep indicator pinned/updated even when pointer is outside the UL.
      const pinned = pinIndexIfOutsideUl(e.clientY);
      if (typeof pinned === "number") {
        showIndicatorAt(pinned);
        return;
      }

      // If inside UL bounds, compute normal index (works in gaps too)
      showIndicatorAt(computeIndexFromPointer(e.clientY));
    }

    function onDocDrop(e) {
      if (!isDragging || !dragKey) return;

      // If drop occurs, we want to commit using the last shown indicator index.
      // Prevent default so the browser doesn't navigate (some Safari cases).
      e.preventDefault();

      if (typeof dropIndex === "number") {
        commitReorder(dropIndex);
      }

      // Cleanup happens in dragend too, but we do it here as well for safety.
      cleanupGlobalDnD();
    }

    function cleanupGlobalDnD() {
      document.removeEventListener("dragover", onDocDragOver, true);
      document.removeEventListener("drop", onDocDrop, true);
    }

    // UL dragover still helps keep indicator responsive when hovering list items
    ul.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragKey) return;

      const li = e.target.closest(".schema-item");
      if (li && ul.contains(li)) {
        const items = getItemsNoIndicator();
        const targetKey = li.getAttribute("data-key");
        const targetIdx = items.findIndex((x) => x.getAttribute("data-key") === targetKey);
        if (targetIdx >= 0) {
          const rect = li.getBoundingClientRect();
          const insertBefore = (e.clientY - rect.top) < rect.height / 2;
          showIndicatorAt(insertBefore ? targetIdx : targetIdx + 1);
          return;
        }
      }

      showIndicatorAt(computeIndexFromPointer(e.clientY));
    });

    // UL drop handler (works when dropping inside the list)
    ul.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragKey) return;

      const insertAtRaw =
        (typeof dropIndex === "number") ? dropIndex : computeIndexFromPointer(e.clientY);

      commitReorder(insertAtRaw);
    });

    // Delegated dragstart/dragend
    ul.addEventListener("dragstart", (e) => {
      const li = e.target.closest(".schema-item");
      if (!li || !ul.contains(li)) return;

      dragKey = li.getAttribute("data-key");
      li.classList.add("dragging");
      isDragging = true;

      // Safari compatibility: set *some* drag data
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", dragKey || "");
      } catch {
        // ignore
      }

      // Global handlers so dropping outside UL is still a valid drop target
      document.addEventListener("dragover", onDocDragOver, true);
      document.addEventListener("drop", onDocDrop, true);

      // Ensure indicator shows immediately
      showIndicatorAt(computeIndexFromPointer(e.clientY));
    });

    ul.addEventListener("dragend", (e) => {
      const li = e.target.closest(".schema-item");
      if (li) li.classList.remove("dragging");

      isDragging = false;
      dragKey = null;

      cleanupGlobalDnD();
      clearIndicator();
    });
  }

  function wireAvailableList() {
    const el = ctx.availableListEl;
    if (!el) return;

    el.addEventListener("change", (e) => {
      const cb = e.target.closest('input[type="checkbox"][data-field]');
      if (!cb) return;

      const key = cb.getAttribute("data-field");
      if (!KEY_SET.has(key)) return;

      const arr = getFields();
      const has = arr.includes(key);

      if (cb.checked && !has) {
        arr.push(key); // add to end of selected order
        setFields(arr);
      } else if (!cb.checked && has) {
        setFields(arr.filter((k) => k !== key));
      }
    });
  }

  function init(c) {
    ctx = { ...ctx, ...(c || {}) };
    selected = load() || defaultSelected();

    // Persist open/closed state of the export schema details
    try {
      const detailsEl = document.getElementById("exportSchemaDetails");
      if (detailsEl) {
        // restore
        try { detailsEl.open = localStorage.getItem(SCHEMA_OPEN_KEY) === "1"; } catch {}

        // persist
        detailsEl.addEventListener("toggle", () => {
          try { localStorage.setItem(SCHEMA_OPEN_KEY, detailsEl.open ? "1" : "0"); } catch {}
        });
      }
    } catch {}

    // IMPORTANT: make sure summary label reflects current state on first load
    updateSummaryLabel();

    render();
    wireAvailableList();
  }

  window.App.exportSchema = {
    init,
    getFields,
    setFields,
    resetToDefaults,
    clearStorage,
    FIELD_DEFS,
  };
})();
