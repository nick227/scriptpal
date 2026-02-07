# Version Dropdown: Main Use Cases and User Flows

## Assumptions

- **Version state** lives on the **app StateManager** (`EDITOR_MODE`, `EDITOR_PREVIEW_VERSION`). Toolbar, SaveService, and Coordinator read it via `appStateManager` (or `globalStateManager`).
- **Editor never loads in preview:** Init and every `loadScript` / `refreshVersionDropdown` set app state to `edit` and call `toolbar.setEditorMode('edit')` before any async work.
- **Dropdown programmatic changes** use `_suppressVersionDropdownChange` so setting the select value does not fire the change handler.

---

## Flow 1: Initial page load (slug or list selection)

1. User opens app, navigates to `/mine` or `/mine/big-gum` (or selects a script from the list).
2. `loadScriptBySlug` or script selection → `setCurrentScript(script)` → publish `SCRIPT.SELECTED`.
3. `handleCurrentScriptChange(script, { source: 'slug' | 'selection' })` → `editorWidget.loadScript({ script, source, resetHistory: true })`.
4. **loadScript:** Sync: `appState` set `EDITOR_MODE = 'edit'`, `PREVIEW_VERSION = null`; `toolbar.setEditorMode('edit')`. Then `updateContent(script.content)`, then `refreshVersionDropdown(script)`.
5. **refreshVersionDropdown:** Sync: same app state + `setEditorMode('edit')`. Then fetch versions, `setVersions(versions)`, `setCurrentVersion(script.versionNumber)` with suppress flag.

**Result:** Editor shows latest script content. No preview bar. Dropdown shows e.g. "v53 ▾" and list of versions. User can edit and save.

---

## Flow 2: User selects an older version (enter preview)

1. User opens version dropdown, selects e.g. v52 (not latest).
2. Select `change` fires (not suppressed). `versionNumber !== latestVersionNumber` → `versionPreviewRequested({ versionNumber: 52 })`.
3. **Preview handler:** Guard: if already `EDITOR_MODE === 'version-preview'` return. **State flip first:** `appState` set `version-preview` + `PREVIEW_VERSION = 52`, `toolbar.setEditorMode('version-preview', 52)`. Then `getScript(scriptId, 52)` → `updateContent(script.content, { source: 'version_preview' })`. (If a CONTENT_PERSIST fires between updateContent and the next tick, SaveService already sees preview mode.)
4. **Toolbar:** Bar visible; dropdown, Save, and **format buttons** disabled. Coordinator, SaveService, and KeyboardManager (e.g. Tab/indent) use `appStateManager.isEditorReadOnly()`.

**Result:** User sees v52 content, preview bar. Typing, format, indent, save are blocked.

---

## Flow 3: User in preview clicks "Make this the current version" (Restore)

1. `versionRestoreRequested()`.
2. Guard: `EDITOR_MODE === 'version-preview'` and `previewVersion != null`. `setRestoreLoading(true)`.
3. `restoreVersion(scriptId, previewVersion)` → backend creates new version with that content (or returns latest if idempotent).
4. **On success:** `appState` set `edit`; `scriptStore` update from response; `updateContent(response.content, { source: 'version_restore' })`; `toolbar.setEditorMode('edit')`; refetch versions, `setVersions` + `setCurrentVersion(response.versionNumber)`; `setRestoreLoading(false)`.

**Result:** Bar hidden. Editor shows new latest content. User can edit and save.

---

## Flow 4: User in preview clicks Cancel

1. `versionPreviewCancelRequested()`.
2. `scriptStore.loadScript(scriptId, { forceFresh: true })` → then `latest = scriptStore.getCurrentScript()`.
3. `updateContent(latest.content, { source: 'version_cancel' })` (store as source of truth). `appState` set `edit`; `toolbar.setEditorMode('edit')`; `setCurrentVersion(latest?.versionNumber)`.

**Result:** Bar hidden. Editor shows latest again. User can edit.

---

## Flow 5: User in preview selects "Current" from dropdown

- In preview the **dropdown is disabled**, so this cannot happen. User must use Restore or Cancel.

---

## Flow 6: User not in preview selects "Current" (latest) from dropdown

1. User had e.g. v52 selected then changed back to v53 in the dropdown (or re-selects current).
2. `change` fires: `versionNumber === latestVersionNumber` → `versionPreviewCancelRequested()`.
3. Same as Flow 4: refresh from store, set edit, update content and dropdown.

**Result:** Editor shows latest; no bar; can edit. Correct.

---

## Flow 7: Switch to another script while in preview (or in edit)

1. User has script A open (edit or preview). User selects script B from sidebar/list.
2. `setCurrentScript(B)` → publish `SCRIPT.SELECTED` → `handleCurrentScriptChange(B)`.
3. `shouldSkipLoad(B)` is false (different script or version). `loadScript({ script: B, ... })`.
4. **loadScript:** Sync: `appState` set `edit`, `toolbar.setEditorMode('edit')`, then `updateContent(B.content)`, `refreshVersionDropdown(B)`.

**Result:** Editor shows script B in edit mode. Preview bar never appears; if user was previewing A, we leave preview and show B.

---

## Flow 8: Preview fetch fails (e.g. 404 for version)

1. User selects old version → `getScript(scriptId, versionNumber)` throws or returns null content.
2. **Catch / null content:** `appState` set `edit`; `toolbar.setEditorMode('edit')`; `setCurrentVersion(scriptStore.getCurrentScript()?.versionNumber)` (revert dropdown); publish `SCRIPT.ERROR`.

**Result:** User stays in edit mode, bar hidden, dropdown back to current. Can retry by selecting again.

---

## Flow 9: Restore fails (network / server error)

1. User clicks "Make this the current version" → `restoreVersion` throws.
2. **Catch:** Publish `SCRIPT.ERROR`. **Finally:** `setRestoreLoading(false)`.
3. App state and bar are **not** changed (still in preview).

**Result:** User remains in preview with bar visible; can retry Restore or click Cancel.

---

## Flow 10: Cancel fails (e.g. network on forceFresh load)

1. User clicks Cancel → `scriptStore.loadScript(scriptId, { forceFresh: true })` throws.
2. **Catch:** `appState` set `edit`; `toolbar.setEditorMode('edit')`; keep dropdown on known latest: `if (knownLatest != null) toolbar.setCurrentVersion(knownLatest)`; publish `SCRIPT.ERROR` with message **"Could not refresh latest version. Try again."**

**Result:** User leaves preview (bar hidden, edit mode). Dropdown stays on previous latest version number (not null). Toast/message tells user refresh failed so they don’t assume they’re safely on latest.

---

## Flow 11: Editor init with script already selected

1. `initialize()` sets `appState.EDITOR_MODE = 'edit'`, `PREVIEW_VERSION = null` at start.
2. Later: `loadInitialContent(scriptStore)` may run if `currentScript` exists — only `updateContent` and EditorStateManager state; **no** version state or toolbar call.
3. When `SCRIPT.SELECTED` fires (e.g. from slug load), `handleCurrentScriptChange` runs and calls **loadScript**, which again sets edit and refreshes the version dropdown.

**Result:** Version state stays `edit`; bar never shown on init. Dropdown populated when loadScript runs.

---

## Flow 12: Load with no script (script cleared)

1. `loadScript({ script: null })` or `script` without `id`.
2. **loadScript:** Still sets `appState` edit and `toolbar.setEditorMode('edit')`. `contentValue = ''`. `refreshVersionDropdown(script)` runs.
3. **refreshVersionDropdown:** Same app state + toolbar edit. Then `if (!script?.id)` → `toolbar.setVersions([])`, `setCurrentVersion(null)`, return.

**Result:** Editor empty, edit mode, no preview bar, version dropdown cleared.

---

## Summary

| Flow              | App state / bar              | Editor content     | Editable |
|-------------------|------------------------------|--------------------|----------|
| 1. Load script     | edit, bar hidden             | Latest             | Yes      |
| 2. Select old ver  | version-preview, bar visible | That version       | No       |
| 3. Restore         | edit, bar hidden             | New latest         | Yes      |
| 4. Cancel          | edit, bar hidden             | Latest from store  | Yes      |
| 6. Select current  | edit, bar hidden             | Latest             | Yes      |
| 7. Switch script   | edit, bar hidden             | New script latest  | Yes      |
| 8. Preview error   | edit, bar hidden             | Unchanged          | Yes      |
| 9. Restore error   | version-preview, bar visible | Unchanged          | No       |
| 10. Cancel error   | edit, bar hidden             | Unchanged          | Yes      |

All main use cases and error paths leave the UI in a consistent state and avoid getting stuck in preview.
