# Proposal: Script Version Dropdown (Preview & Restore)

## Goal

Add a version dropdown in the editor toolbar that lets users:
1. **Preview** and **load** an older version of the current script into the editor.
2. See a **confirmation step** (Accept / Cancel) when viewing an old version.
3. **Accept** = duplicate that old version as the **newest** script version (restore); **Cancel** = return to current latest without changing the script.

---

## Scope

- **Placement:** Editor toolbar (`.editor-toolbar`), e.g. near Save/Undo/Redo or after format buttons.
- **Current script only:** Dropdown is active only when a script is loaded and owned by the user; no version list for “no script” or public view.
- **Lock instead of visual preview:** When viewing an older version, the editor looks identical to normal (no tint/badge). The document is **read-only** until the user clicks **Restore this version** or **Cancel**.

---

## Version-preview behavior (read-only lock)

When `editorMode === 'version-preview'` (user has selected an old version):

| Allowed | Blocked |
|--------|--------|
| Editor content loads normally | Typing |
| Cursor can move | Paste |
| Text selection | Delete |
| | Format changes |
| | Save (manual and autosave) |

The toolbar shows prominent actions: **Restore this version** and **Cancel**. No special visual styling (tint/badge) on the editor area—behavior is enforced by locking edits and save.

---

## Backend

### 1. List versions for a script

- **Endpoint:** `GET /script/:id/versions` (or `GET /script/:scriptId/versions`).
- **Auth:** Session + script ownership (reuse existing script ownership middleware).
- **Response:** Array of version summaries: **only** `[{ versionNumber, createdAt }]` (no contentLength, no content, no hash). Ordered by `versionNumber` desc (newest first). Simple, small payload, fast; UI only needs labels.
- **Implementation:** Use a list method that selects only `versionNumber` and `createdAt` (no full content) so the list is cheap.

### 2. Get script at a specific version

- **Option A (recommended):** Extend existing `GET /script/:id` to accept optional query: `?version=52`.
- **Option B:** New endpoint `GET /script/:id/versions/:versionNumber` that returns the same shape as `getScript` but for that version.
- **Auth:** Same as current GET script (session + ownership).
- **Implementation:** `scriptModel.getScript(id, versionNumber)` already exists; controller reads `req.query.version` (or `req.params.versionNumber`) and passes it through. Return 404 if that version does not exist.

### 3. “Restore” = duplicate old version as newest

- **Endpoint:** `POST /script/:id/versions/:versionNumber/restore` (or `POST /script/:id/restore-version` with body `{ versionNumber }`).
- **Auth:** Session + script ownership.
- **Transaction:** The entire restore runs inside a single DB transaction: load target version → load latest version → compare content → conditionally create new version → return resulting script. This prevents races when two restores happen simultaneously and guarantees `versionNumber` correctness.
- **Behavior:**
  - Load the requested version (e.g. 52) for script `id`. If not found, return 404.
  - **Idempotency / safety:** Compare **normalized** content of the selected old version with the latest (using the same normalization used for saves—e.g. trim, JSON parse+stringify for storage format). If identical → do **not** create a new version; return the latest script (same shape as GET script). Idempotency only applies when restored content equals current latest; avoids version spam and extra DB rows.
  - Otherwise: create a **new** script version; **version number is decided only by the backend** (e.g. `latest + 1`). Frontend never computes version numbers; it always reads them from the server response.
  - Optionally create a `scriptCommand` record for audit (e.g. type `restore_version`, payload `{ fromVersion: 52 }`).
  - **Analytics / logging:** Emit or log an event on restore, e.g. `script_version_restored` with `{ scriptId, fromVersion, toVersion }` for debugging and incident analysis.
  - Return the updated script (same shape as GET script).
- **Implementation:** Run in `prisma.$transaction` (or equivalent): getByScriptIdAndVersion, getLatestByScriptId; compare content (or hash); if same, return `toScriptWithVersion(script, latestVersion)`; else create new version and return.

---

## Frontend

### 4. Version dropdown in EditorToolbar

- **Component:** A dropdown (native `<select>` or custom) in the toolbar.
- **Label:** Show current version number in the toolbar at all times when a script is loaded, e.g. **v53 ▾** (version number + chevron). Dropdown shows list of versions. This builds the user’s mental model that versions exist and makes restore more intuitive.
- **Data:** When the current script changes, fetch versions via the new list endpoint. Store in toolbar or a small “version” store/state.
- **Display:** Each option: version number + short date (e.g. “v52 – Feb 6, 12:46”). Current/latest can be marked (e.g. “Current” or bold).
- **Disabled when:** No script loaded, script not owned by user (e.g. public viewer), list not yet loaded, **or `editorMode === 'version-preview'`** (prevents stacking: e.g. previewing v40 while already previewing v52; keeps state machine simple).

### 5. Selecting an old version (preview)

- **On select:** If the user picks a version that is **not** the latest:
  - Fetch full script for that version (GET script with `?version=52` or equivalent).
  - Call existing editor “load content” path: e.g. `contentComponent.updateContent(script.content, { source: 'version_preview', ... })` so the editor shows that version’s content.
  - Set **editor mode** to `version-preview` and `previewVersionNumber`; show confirmation bar; do **not** create a new version yet.
- **If user selects the latest version again:** Set editor mode back to `edit`, load latest script (normal load), hide confirmation bar.

### 6. Confirmation bar (Restore this version / Cancel)

- **When `editorMode === 'version-preview'`** (viewing an old version):
  - Show a bar (e.g. above or below the toolbar, or as a banner in the editor area) with:
    - **Copy (two-line, clearer scan):**
      - Line 1: “You are viewing version 52.”
      - Line 2: “Restore to make this the current version, or Cancel to return to the latest.”
    - **Restore this version** button.
    - **Cancel** button.
- **Restore this version:**
  - Call restore endpoint: `POST /script/:id/versions/:versionNumber/restore` (or equivalent).
  - **On success:** Update local script state with the **response body** (no additional GET). Load editor content from that response. Set editor mode to `edit`, hide bar, update dropdown to show new latest. This reduces latency and avoids flicker.
  - On error: show error message, keep `editorMode === 'version-preview'` and bar.
- **Cancel:**
  - Fetch latest script again (e.g. `scriptStore.loadScript(scriptId, { forceFresh: true })`). Then use **store as source of truth:** `const latest = scriptStore.getCurrentScript(); content.updateContent(latest.content, ...)`. Set editor mode to `edit`, hide bar, reset dropdown to latest. This guarantees the render uses the same object the store considers canonical and prevents races if another system updated the store concurrently.

### 7. Save and version-preview mode

- While **`editorMode === 'version-preview'`**: Disable Save button and show tooltip “Restore this version to edit and save.” No manual save until user exits (Restore or Cancel).

### 8. Autosave guard

When **`editorMode === 'version-preview'`**, **EditorSaveService** must not perform any save, regardless of UI state. This prevents blur/focus or future code paths from persisting content while the user is only viewing an old version.

- In **EditorSaveService.flushSave()**: at the start of the method, if `editorMode === 'version-preview'`, **return false** immediately. Do not queue patch, do not call flushPatch.
  - Add a debug log so the block is visible in console: e.g. `console.warn('[EditorSaveService] Save blocked (version preview mode)');` then `return false;`. This would have helped catch the earlier corruption faster.
- Effect: **CONTENT_PERSIST** and **FOCUS_OUT** events may still fire, but `flushSave()` exits early and no request is sent.
- **Requirement:** `editorMode` must be available to EditorSaveService (e.g. via stateManager or options). When `editorMode !== 'edit'`, treat as hard block—no save path should run.

### 8b. Central mutation guard (lock below UI)

UI-level blocking (toolbar, keyboard controller) is not enough. A guard must exist in the editor’s **central mutation path** so that any future code path (plugins, macros, AI insertion, programmatic edits) cannot mutate content in version-preview mode.

- In **EditorCoordinator.applyCommand** (or the equivalent single entry point for document edits): at the start, if `editorMode === 'version-preview'`, **return false** (or no-op). Do not apply the command.
- This ensures all edits—keyboard, paste, format, API-driven—go through one gate that refuses when not in `edit` mode.

### 8c. Single read-only gate (isEditorReadOnly)

**Preview is pure view-layer state.** Add one centralized helper so all mutation paths use the same check and cannot drift.

- **StateManager** (or editor state): `isEditorReadOnly()` returns `true` when:
  - `editorMode === 'version-preview'`
  - (future) collaboration read-only
  - (future) public view inside editor
- **All of the following** check at entry: `if (stateManager.isEditorReadOnly()) return;` (or return false / no-op):
  - Keyboard handlers (Enter, delete, merge, etc.)
  - **EditorCoordinator:** `applyCommands`, `setCurrentLineFormat`, `insertLineAfter`, `deleteLinesById`, `mergeLinesById`
  - **EditorSaveService.flushSave**
- Prevents accidental bypass paths and keeps one boolean source of truth instead of six separate checks.

### 9. Wiring and dependencies

- **EditorWidget / ScriptsController:** When current script is set, trigger “fetch versions for script” and pass list to toolbar (or toolbar fetches via API). Toolbar needs `scriptId` and optionally `currentVersionNumber`.
- **Toolbar:** Needs API (or callback) to: list versions, get script by version, restore version. Can use existing `ScriptService` extended with `getScriptVersions(scriptId)`, `getScript(scriptId, versionNumber)`, `restoreVersion(scriptId, versionNumber)`.
- **State:** Use a single source of truth for mode: `{ editorMode: 'edit' | 'version-preview', previewVersionNumber?: number }`. When viewing an old version, set `editorMode: 'version-preview'` and `previewVersionNumber: 52`. In guards use `if (editorMode !== 'edit') return false;` (or `if (editorMode === 'version-preview') return false;`). This scales if you add modes later (e.g. readonly share, diff, conflict). Expose `editorMode` to EditorSaveService and the central mutation path for the save and edit locks.

---

## Implementation Steps (Order)

1. **Backend: List versions**  
   - Add `GET /script/:id/versions` (or under existing script route group).  
   - Handler: ownership check, then `scriptVersionRepository.listByScriptId(id)`, return array of `{ versionNumber, createdAt }` (and optionally `contentLength`).  
   - Add route and test (e.g. manual or integration test).

2. **Backend: Get script by version**  
   - Add optional `version` query to existing `GET /script/:id`, or add `GET /script/:id/versions/:versionNumber`.  
   - Handler: ownership, then `scriptModel.getScript(id, versionNumber)`, return same JSON shape as current getScript.  
   - Add route and test.

3. **Backend: Restore version**  
   - Add `POST /script/:id/versions/:versionNumber/restore` (or `POST /script/:id/restore-version` with body).  
   - Run in a single DB transaction: load target version, load latest, compare content; if same return latest (idempotent), else create new version; optional command log; emit/log `script_version_restored`; return script.  
   - Add route and test.

4. **Frontend: API client**  
   - Extend script API (e.g. `ScriptService` or `ScriptPalAPI.scripts`) with:  
     - `getScriptVersions(scriptId)`  
     - `getScriptByVersion(scriptId, versionNumber)` (if not using query on existing getScript)  
     - `restoreVersion(scriptId, versionNumber)`  
   - Use existing auth and error handling.

5. **Frontend: Version dropdown in toolbar**  
   - In `EditorToolbar`, add a version dropdown element (e.g. after format buttons or near save).  
   - On script load / current script change: fetch versions, populate dropdown, set selected to current version.  
   - On change: if selected version !== latest, trigger “load preview” (step 6). If selected === latest, load latest and exit preview.

6. **Frontend: Load old version into editor (preview)**  
   - When user selects an old version: call getScriptByVersion, then call existing editor `updateContent(script.content, { source: 'version_preview' })` (or equivalent).  
   - Set state: `editorMode: 'version-preview'`, `previewVersionNumber`.  
   - Show confirmation bar. Disable version dropdown (no stacking previews).

7. **Frontend: Confirmation bar**  
   - Add a bar with two-line copy (“You are viewing version 52.” / “Restore to make this the current version, or Cancel to return to the latest.”), **Restore this version**, **Cancel**.  
   - Restore: call restoreVersion; on success update local script state and editor from **response body** (no extra GET); set `editorMode: 'edit'`; hide bar; update dropdown.  
   - Cancel: fetch latest, load into editor; set `editorMode: 'edit'`; hide bar; reset dropdown.

8. **Frontend: Save disabled when not edit mode**  
   - When `editorMode === 'version-preview'`, disable Save and show tooltip “Restore this version to edit and save.”

9. **Frontend: Autosave guard**  
   - In **EditorSaveService.flushSave()**: if `editorMode === 'version-preview'`, log `[EditorSaveService] Save blocked (version preview mode)` and return false. Ensure `editorMode` is available to the save service.

10. **Frontend: Central mutation guard**  
   - In **EditorCoordinator.applyCommand** (or equivalent): if `editorMode === 'version-preview'`, return false. Blocks all edits (keyboard, paste, format, AI, programmatic) at the core mutation layer.

11. **Frontend: Read-only lock when version-preview**  
   - When `editorMode === 'version-preview'`: allow cursor move and selection; block typing, paste, delete, format changes (enforced at UI and at EditorCoordinator.applyCommand). Editor looks identical; behavior only is read-only.

12. **Polish**  
   - Accessibility: dropdown and bar have labels, focus order, keyboard support.  
   - Loading states: “Loading versions…”, “Restoring…” on Restore.  
   - Error handling: list/get/restore failures show user-facing message.

---

## Out of scope (for later)

- Version diff view (side-by-side or inline diff).
- Deleting or “pinning” versions.
- Public script version dropdown (this proposal is editor / “mine” only).

---

## Files to touch (reference)

- **Server:** `routes.js` (new routes), `server/controllers/script/script.controller.js` (getScript with version query + listVersions + restoreVersion), `server/repositories/scriptVersionRepository.js` (already has listByScriptId, getByScriptIdAndVersion, create), `server/models/script.js` (getScript(id, version) already exists).
- **Frontend:** `public/js/widgets/editor/EditorToolbar.js` (dropdown + confirmation bar or delegate to a small component), `public/js/services/api/ScriptService.js` (new methods), script store or coordinator for `editorMode` and “load script by version” / “restore” wiring, `EditorCoordinator` (applyCommand guard), `EditorSaveService` (flushSave guard), optional small `VersionDropdown.js` or `VersionPreviewBar.js` if we split UI.

---

## Risk note

The only meaningful risk is that preview loads old content into the same editor instance. This is acceptable because: (1) saves are blocked when `editorMode === 'version-preview'`, (2) edits are blocked at the central mutation path, and (3) Restore explicitly duplicates content into a new version. The proposal handles all three.

---

## Summary

| Step | What |
|------|------|
| 1 | Backend: `GET /script/:id/versions` → list version numbers + dates. |
| 2 | Backend: `GET /script/:id?version=N` → script at version N. |
| 3 | Backend: `POST /script/:id/versions/:versionNumber/restore` → if content equals latest, return latest (idempotent); else create new version, return script. |
| 4 | Frontend: API client for list / get-by-version / restore. |
| 5 | Frontend: Version dropdown in editor toolbar; populate on script load. |
| 6 | Frontend: On select old version → load into editor, set preview mode (read-only lock). |
| 7 | Frontend: Confirmation bar (Restore this version / Cancel). |
| 8 | Frontend: Disable Save in preview; toolbar shows Restore / Cancel. |
| 9 | Frontend: **Autosave guard:** in `EditorSaveService.flushSave()`, if `editorMode === 'version-preview'` log and return false. |
| 10 | Frontend: **Central mutation guard:** in EditorCoordinator.applyCommand (or equivalent), if `editorMode === 'version-preview'` return false. |
| 11 | Frontend: Read-only lock + dropdown disabled in version-preview; toolbar shows “v53 ▾” always when script loaded. |
| 12 | Polish: a11y, loading, errors. |
