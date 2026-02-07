# Version Preview: How Content Is Rendered, and What Cancel vs Restore Do

## State machine and robustness

- **Single source of truth:** `StateManager`: `EDITOR_MODE` (`'edit' | 'version-preview'`) and `EDITOR_PREVIEW_VERSION` (number | null). Toolbar bar visibility and disabled states are driven only by explicit `setEditorMode(...)` calls (never derived from state on init).
- **Never load into preview:** On script load, `loadScript` and `refreshVersionDropdown` always set `EDITOR_MODE` to `'edit'` and call `toolbar.setEditorMode('edit')` before any async work, so the bar never appears on initial load.
- **Toolbar init:** After `createVersionPreviewBar()`, `setEditorMode('edit')` is called so the bar is hidden regardless of any stale state.
- **Dropdown programmatic changes:** When `setVersions` or `setCurrentVersion` set the select value, `_suppressVersionDropdownChange` is set so the `change` handler does not run (avoids firing Cancel on load).
- **Preview:** Guard: if already `EDITOR_MODE === 'version-preview'`, the preview handler returns (no re-entry). On success we set state and toolbar to preview. On failure or null content we reset to edit, hide bar, and revert dropdown to current version so the UI is never stuck.
- **Restore:** Guard: runs only when `EDITOR_MODE === 'version-preview'` and `previewVersion != null`. Loading state disables Restore/Cancel. On failure we leave mode as preview so the user can retry or cancel.
- **Cancel:** On success we set state to edit, load latest content from store, hide bar, set dropdown to latest. On failure we still reset state and bar and revert dropdown to store’s current version so the user is not stuck in preview.

---

## 1. How preview content is rendered in the editor

### Trigger

- User opens the version dropdown in the toolbar (e.g. "v53 ▾") and selects an **older** version (e.g. v52).
- The dropdown’s `change` handler runs (`EditorToolbar.js`). If the selected version is not the latest, it calls `versionPreviewRequested({ versionNumber })`.

### Loading the version and updating state

1. **EditorWidget** (`setupVersionHandlers`) receives the callback:
   - Gets current script ID from `scriptStore`.
   - Calls **API** `getScript(scriptId, versionNumber)` → `GET /script/:id?version=N`.
   - Backend returns that version’s script (including its **content** string).
   - If `script.content` is null/undefined, the handler returns and nothing is shown.

2. **Rendering the preview content in the editor:**
   - The same content area used for editing is reused; there is no separate “preview” DOM.
   - `content.updateContent(script.content, { source: 'version_preview', focus: false })` is called.
   - Here `content` is the **EditorCoordinator** (the editor’s “content” component).

### Content update pipeline (preview and all other sources)

`content.updateContent(...)` flows through the coordinator into the document model and then the DOM:

1. **EditorCoordinator.updateContent(content, options)**  
   - Validates content.  
   - Calls `this.documentService.setContent(content)` so the in-memory **ScriptDocument** holds the preview content.  
   - Calls `this.renderController.renderDocument(this.documentService.getDocument(), options)`.

2. **EditorRenderController.renderDocument(document, options)**  
   - Delegates to **EditorDOMHandler** (and its **EditorRendererAdapter**) to turn the document into DOM.

3. **EditorDOMHandler**  
   - Uses the parser to interpret content if needed, then **EditorRendererAdapter.updateContent** (or **renderDocument**):
     - Parses the content string into **lines** (format + text).
     - Ensures enough **pages** exist (page manager).
     - Clears/rebuilds the visible page content and creates one DOM element per line (e.g. `.script-line`), appends them into the editor page container, and updates the line–element map.

4. **Result**  
   - The editor’s visible area shows the **old version’s content** (same lines, formats, structure as that version). No separate “preview” iframe or div; it’s the same editor surface.

### UI and state after entering preview

- **StateManager** is updated so the app knows we’re in read-only preview:
  - `EDITOR_MODE` = `'version-preview'`
  - `EDITOR_PREVIEW_VERSION` = selected `versionNumber`
- **Toolbar** is updated via `toolbar.setEditorMode('version-preview', versionNumber)`:
  - The **version preview bar** is shown (two-line message + “Restore this version” and “Cancel”).
  - The **version dropdown** is disabled.
  - The **Save** button is disabled and its tooltip explains that the user must restore to edit/save.

### Important: script store and edits during preview

- **ScriptStore** is **not** updated with the old version. The store’s “current script” still refers to the **latest** version; only the **editor’s displayed content** is switched to the selected version.
- **Edits are blocked** while in preview: `EditorCoordinator.applyCommands` returns `{ success: false, reason: 'version_preview' }` when `editorMode === 'version-preview'`, and `EditorSaveService.flushSave` refuses to save. So the user can only view the old content, not change it, until they Cancel or Restore.

---

## 2. What “Cancel” does

Cancel means: **leave preview and show the latest version again; do not change anything on the server.**

1. User clicks **Cancel** in the version preview bar.
2. **EditorWidget** (`onVersionPreviewCancelRequested`):
   - Gets current script ID.
   - Calls **scriptStore.loadScript(scriptId, { forceFresh: true })** so the latest script (and its content) is fetched from the API again and stored.
   - With that fresh script: **content.updateContent(script.content, { source: 'selection', focus: false })**.
     - Same pipeline as above: document service is updated, then `renderDocument` runs, so the DOM shows the **latest** version’s content.
   - State is cleared from preview mode:
     - `EDITOR_MODE` = `'edit'`
     - `EDITOR_PREVIEW_VERSION` = `null`
   - **Toolbar**: `toolbar.setEditorMode('edit')` (hides preview bar, re-enables dropdown and Save), then `toolbar.setCurrentVersion(script.versionNumber)` so the dropdown displays the latest version (e.g. “v53”) as selected.

3. **No API call** to a “cancel” endpoint; no version is restored. The server is unchanged. The user is back to editing the current latest version.

---

## 3. What “Restore this version” (Accept) does

Restore means: **make the previewed version the new latest version on the server, then show that content in the editor and leave preview mode.**

1. User clicks **Restore this version** in the version preview bar.
2. **EditorWidget** (`onVersionRestoreRequested`):
   - Gets script ID and the previewed version number from state (`EDITOR_PREVIEW_VERSION`).
   - **Toolbar**: `toolbar.setRestoreLoading(true)` (disables Restore/Cancel, shows “Restoring…”).
   - Calls **API** `restoreVersion(scriptId, previewVersion)` → **POST** `/script/:id/versions/:versionNumber/restore`.
3. **Backend** (in a transaction):
   - Loads the requested version’s content and the current latest version.
   - If content is already the same as latest, no new version is created (idempotent).
   - Otherwise creates a **new** script version (e.g. v54) whose content is a copy of the restored version (e.g. v52), and updates the script’s “latest” pointer. May also create a scriptCommand for audit.
   - Returns the **updated script** (new version number and that content).
4. **EditorWidget** (after restore response):
   - Sets state back to edit: `EDITOR_MODE` = `'edit'`, `EDITOR_PREVIEW_VERSION` = `null`.
   - Updates app state and cache with the response:
     - `scriptStore.updateScriptInCache(response)`
     - `scriptStore.setCurrentScript(response, { source: 'update' })`
   - Renders the new latest content in the editor: **content.updateContent(response.content, { source: 'restore', focus: false })** (same pipeline: document service → renderDocument → DOM).
   - **Toolbar**: `toolbar.setEditorMode('edit')`, then refetches **GET** `/script/:id/versions`, and updates the dropdown with `toolbar.setVersions(versions)` and `toolbar.setCurrentVersion(response.versionNumber)` so the dropdown shows the new latest (e.g. “v54 (Current)”).
   - **Toolbar**: `toolbar.setRestoreLoading(false)` (in `finally`), so the bar buttons are enabled again.

5. **Result**  
   - The server’s “latest” is now the restored content (new version number). The editor shows that same content and is in normal edit mode; the user can edit and save as usual.

---

## Summary

| Action   | Server change? | What the user sees next                         |
|----------|----------------|--------------------------------------------------|
| **Preview** | No           | Old version’s content in the same editor area; bar + disabled Save/dropdown. |
| **Cancel**  | No           | Latest version’s content again; bar hidden; edit mode. |
| **Restore** | Yes (new version with old content) | New latest content in editor; bar hidden; edit mode; dropdown shows new version. |

Preview content is rendered by feeding the version’s `content` string into the same `updateContent` → document service → `renderDocument` path used for normal loading, so the DOM is rebuilt to show that version’s lines in the existing editor container.
