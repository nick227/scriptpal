# Proposal: Script Export Button and Functionality

## Goal

Add an **Export** control to the editor toolbar that lets users download the current script as:
1. **TXT** – plain text (one line per script line, no markup).
2. **JSON** – storage format (same structure as saved script content, with `lines` array).

Export is client-side only: no new server endpoints. The button is available when a script is loaded in the editor.

---

## Scope

- **Placement:** Editor toolbar (`.editor-toolbar`), e.g. after the version dropdown and before the page counter, or after format buttons.
- **Current script only:** Export uses the document currently in the editor (and optional metadata from script store). No export when no script is loaded.
- **Formats (initial):** TXT and JSON only. No PDF or FDX in this phase.

---

## Where to Keep and Organize the Service

### Recommended: Editor export module under `public/js/widgets/editor/export/`

- **New file:** `public/js/widgets/editor/export/ScriptExportService.js`
- **Reasoning:**
  - Mirrors existing **save** flow: `EditorSaveService` lives in `public/js/widgets/editor/save/` and is wired from `EditorWidget` with dependencies on `content`, `toolbar`, `scriptStore`, `stateManager`. Export has the same dependency shape (content + scriptStore for title/filename).
  - Keeps all editor feature logic (save, export) under `widgets/editor/` and avoids scattering editor-specific behavior into `public/js/services/`.
  - `public/js/services/` is used for API clients (`api/`), app-level editor controller (`editor/EditorController.js`), and script orchestration (`script/`). Export is a **use-case** of the editor (like save), not a shared API or app controller, so co-locating with the editor widget is consistent.

### Alternative (if you prefer a single “script” service layer)

- **Location:** `public/js/services/script/ScriptExportService.js`
- **Use when:** You want all script-related operations (CRUD, sync, export) under `services/script/`. Export would then be called from the toolbar or EditorWidget with `content` and `scriptStore` passed in. Slightly more indirection than wiring inside the editor component tree.

**Recommendation:** Use `public/js/widgets/editor/export/ScriptExportService.js` and wire it from `EditorWidget` (same pattern as `EditorSaveService`).

---

## Data Sources (Source of Truth)

- **TXT:** Use the content component’s **plain text** API (e.g. `content.getPlainText()`). The editor’s document model already exposes this (e.g. `ScriptDocument.toPlainText()` → lines joined by `\n`).
- **JSON:** **Raw storage content only.** Use `content.getContent()` — the exact JSON string the save flow uses (includes `lines` array with `id`, `format`, `content` per line). Do **not** wrap in an object with title/metadata; export is the same format as persisted content.

No server round-trip: both formats are derived from the in-memory editor document.

---

## Implementation Plan

### 1. Export service

- **File:** `public/js/widgets/editor/export/ScriptExportService.js`
- **Responsibilities:**
  - `exportAsTxt()` – get plain text from content; guard empty document (see below); build filename with version suffix; call `_downloadBlob({ data, mime: 'text/plain', filename })`.
  - `exportAsJson()` – get raw storage content from content; guard empty; build filename with version suffix; call `_downloadBlob({ data, mime: 'application/json', filename })`.
  - **Unified private helper:** `_downloadBlob({ data, mime, filename })` – create temporary `<a download>` with Blob URL, click, revoke URL. Both exports use this; keeps logic centralized and testable.
  - **Shared filename helper:** `sanitizeFilename(title)` – used for both formats and reusable for import later. Rules: lowercase; spaces → dashes; remove `/ \ ? % * : | " < >`; trim to ~80 chars.
- **Dependencies (constructor):** `content`, `scriptStore` (title + version for filename), `stateManager` (for preview version when in version-preview mode). Optional: toast/notify callback for “Nothing to export”.
- **Empty-document guard:** Before starting export, e.g. `const text = content.getPlainText(); if (!text || !text.trim()) { toast("Nothing to export"); return; }`. Prevents generating empty files. For JSON, equivalent check on `content.getContent()` (e.g. empty or only `{"lines":[]}`).

### 2. Editor toolbar: Export button and menu/dropdown

- **File:** `public/js/widgets/editor/EditorToolbar.js`
- **UI options (pick one for initial implementation):**
  - **Option A – Single “Export” button that opens a small dropdown:** One toolbar button (e.g. icon “download”), click opens a dropdown with “Export as TXT” and “Export as JSON”. Keeps toolbar compact.
  - **Option B – Two buttons:** “Export TXT” and “Export JSON” in the toolbar. Simpler code, more toolbar items.
- **Recommendation:** Option A (one Export button + dropdown) to match patterns like “Save” and “Import” and keep the bar uncluttered.
- **Behavior:**
  - Export button visible when a script is loaded.
  - **Allow export in version-preview mode** — export remains enabled when viewing an old version so users can download that version (filename will reflect preview version; see Filename below).
  - On “Export as TXT”: call `ScriptExportService.exportAsTxt()`.
  - On “Export as JSON”: call `ScriptExportService.exportAsJson()`.
- **New elements:** One export button, one dropdown container (hidden by default), two options (TXT, JSON). Reuse existing toolbar styles (e.g. `.format-button`) and any existing dropdown pattern in the app.

### 3. Wiring in EditorWidget

- **File:** `public/js/widgets/editor/EditorWidget.js`
- **Component definition:** Add a new component (e.g. `exportService`) in `initializeComponentDefinitions()`:
  - Deps: `content`, `toolbar`, `scriptStore`, `stateManager` (for preview version when in version-preview mode).
  - Init: instantiate `ScriptExportService` with `content`, `scriptStore`, and `stateManager`.
- **Toolbar:** Pass the export service (or its methods) to the toolbar so the toolbar can call `exportAsTxt()` and `exportAsJson()` on click. Alternatively, the toolbar receives a callback from the widget (e.g. `onExportRequested({ format: 'txt' | 'json' })`) and the widget delegates to the export service. Prefer callback if you want to keep the toolbar free of direct service references.
- **Export enabled when script is loaded;** no “version-preview disables export” — export is allowed in preview mode.

### 4. Filename (version suffix)

- **Pattern:** `{sanitizedTitle}_v{version}.{ext}` so exports don’t overwrite each other and preserve history externally.
- **Examples:** `my-script_v53.txt`, `my-script_v53.json`.
- **Version source:**
  - Normal: `const version = scriptStore.getCurrentScript()?.versionNumber`
  - When previewing: `const version = stateManager.getState(StateManager.KEYS.EDITOR_PREVIEW_VERSION) ?? scriptStore.getCurrentScript()?.versionNumber` (preview version if set, else latest).
- **Title:** From script store (current script title); pass through `sanitizeFilename(title)` once (see §1). Fallback e.g. `script` if no title.

#### sanitizeFilename (shared helper, reuse for import later)

- **Location:** Inside `ScriptExportService.js` (export-time); can be moved to a shared util later if import needs it.
- **Rules:** lowercase; spaces → dashes; remove `/ \ ? % * : | " < >`; trim to ~80 chars.

### 5. CSS

- **File:** `public/css/components/editor.css` (or existing toolbar styles).
- **Add:** Styles for the export button and dropdown (e.g. `.export-button`, `.export-dropdown`, `.export-option`) so they match the existing toolbar look (e.g. `.format-button`, `.toolbar-version-dropdown`).

### 6. Tests (optional for proposal)

- Unit tests for `ScriptExportService`: `sanitizeFilename()` rules; `_downloadBlob` receives correct `{ data, mime, filename }` from both exports; empty-document guard skips download and triggers toast.
- Toolbar: assert export button exists and is disabled when no script; **enabled** in version-preview; dropdown options call the right handler.

---

## File Summary

| Item | Location |
|------|----------|
| Export service | `public/js/widgets/editor/export/ScriptExportService.js` (new) |
| Toolbar button + dropdown | `public/js/widgets/editor/EditorToolbar.js` (modify) |
| Wiring | `public/js/widgets/editor/EditorWidget.js` (component + callback) |
| Styles | `public/css/components/editor.css` (export button/dropdown) |

---

## Out of Scope (Initial)

- PDF or FDX export.
- Server-side export endpoints (unless later required for very large files or server-generated PDF).
- “Export selection only” (full document only for now).

---

## Order of Work

1. Add `ScriptExportService.js` under `public/js/widgets/editor/export/` with `exportAsTxt()` and `exportAsJson()` and Blob download helper.
2. In `EditorToolbar.js`, add export button and dropdown (TXT / JSON); add handler that invokes export (or emits callback).
3. In `EditorWidget.js`, register export service component and wire toolbar to it (or to callback that calls the service).
4. Add toolbar CSS for export control.
5. Manually test: load script, export TXT and JSON, confirm file contents and versioned filenames; test disabled when no script; test export still works in version-preview with preview version in filename; test empty document shows “Nothing to export”.
