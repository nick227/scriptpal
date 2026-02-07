# Version Dropdown Implementation Review (vs Proposal)

## Aligned with proposal

- **Backend:** GET `/script/:id?version=N`, GET `/script/:id/versions`, POST `/script/:id/versions/:versionNumber/restore`; restore in transaction; idempotency (content equals latest); scriptCommand audit; console log `script_version_restored`.
- **Frontend:** `editorMode` + `EDITOR_PREVIEW_VERSION` in state; version dropdown and confirmation bar; Restore / Cancel; dropdown disabled in version-preview; Save disabled + tooltip in preview; autosave guard in `EditorSaveService.flushSave()`; central mutation guard in `EditorCoordinator.applyCommands()`; Restore uses response body (no extra GET); Cancel fetches latest and resets mode.
- **Copy:** Two-line bar text and “Restore this version” / “Cancel” match proposal.

---

## Issues and improvements

### 1. **GET script with invalid version → 404 (proposal §2)**

**Proposal:** “Return 404 if that version does not exist.”

**Current:** When `?version=999` and that version doesn’t exist, the model returns `toScriptWithVersion(script, null)` (content `''`), and the controller returns 200.

**Fix:** In `scriptModel.getScript`, when `versionNumber` is provided and `getByScriptIdAndVersion` returns null, return `null` so the controller can send 404.

---

### 2. **List versions: minimal fields (proposal §1)**

**Proposal:** “Return minimal fields (no full content) so the list is cheap.”

**Current:** `listByScriptId` returns full rows (including `content`). We map to `{ versionNumber, createdAt, contentLength }`, so we still load full content for every version.

**Fix:** Add `listSummaryByScriptId(scriptId)` that selects only `versionNumber`, `createdAt`. Use it in `listVersions` and return `{ versionNumber, createdAt }` (drop `contentLength` unless we add a cheap way to get it later).

---

### 3. **User-facing errors (proposal step 12)**

**Proposal:** “Error handling: list/get/restore failures show user-facing message.”

**Current:** Preview/restore/cancel failures are only `console.error`d.

**Fix:** On restore/preview/cancel failure, publish an app-level error (e.g. `EventManager.EVENTS.SCRIPT.ERROR` or a dedicated event) so the UI can show a toast/banner. Optionally show a short message in the confirmation bar on restore failure.

---

### 4. **Loading state on Restore (proposal step 12)**

**Proposal:** “Loading states: … ‘Restoring…’ on Restore.”

**Current:** No loading state; user can click Restore again while the request is in flight.

**Fix:** While restore is in progress: disable Restore and Cancel (or only Restore), set button text to “Restoring…”, then restore on success or re-enable on error.

---

### 5. **Mark latest as “Current” in dropdown (proposal §4)**

**Proposal:** “Current/latest can be marked (e.g. ‘Current’ or bold).”

**Current:** Options are “v53 – Feb 6, 12:46” etc. with no “Current” label for the latest.

**Fix:** In `setVersions`, for the first option (latest) set label to e.g. “v53 – Feb 6, 12:46 (Current)” or append “ (Current)” so the latest is clearly marked.

---

### 6. **Duplicate bar button handlers (fixed)**

**Current:** Restore and Cancel had both `addEventListener('click')` and handling in `handleToolbarClick`, so the handler could run twice.

**Fix:** Removed the direct `addEventListener` on the two buttons; only the delegated `handleToolbarClick` handles them now.

---

### 7. **Save button click when in preview**

**Current:** Save is disabled in version-preview via `setEditorMode`, so the button shouldn’t fire. If Save were triggered (e.g. shortcut), `flushSave()` correctly returns false. No change required; just confirming behavior.

---

### 8. **Optional: “Loading versions…”**

**Proposal:** “Loading states: ‘Loading versions…’”.

**Current:** No indicator while versions are fetched after script load.

**Fix (optional):** Show “Loading versions…” in the version dropdown area or disable the select until the list is loaded (we already disable when `versions.length === 0`).

---

### 9. **Accessibility (proposal step 12)**

**Proposal:** “Accessibility: dropdown and bar have labels, focus order, keyboard support.”

**Current:** Bar and dropdown have no explicit `aria-*` or `role`. Restore/Cancel are buttons; select is native.

**Fix (optional):** Add `aria-label` on the version select, and on the bar something like `role="status"` and `aria-live="polite"` when visible. Ensure focus order (e.g. Restore then Cancel) and that Restore/Cancel are keyboard-activable (native buttons already are).

---

## Summary

| Item | Severity | Action |
|------|----------|--------|
| GET script invalid version → 404 | High | Model return null when requested version missing |
| List versions minimal fields | Medium | Add listSummaryByScriptId; use in listVersions |
| User-facing errors | Medium | Publish error event on preview/restore/cancel fail |
| Loading state on Restore | Low | Disable Restore + “Restoring…” during request |
| Mark latest “Current” | Low | Append “ (Current)” to latest option |
| Duplicate bar handlers | Fixed | Use only handleToolbarClick for Restore/Cancel |
| Loading versions indicator | Optional | “Loading versions…” or keep disabled until loaded |
| A11y | Optional | aria-label, role, aria-live on bar/dropdown |
