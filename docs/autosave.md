# Auto-Save and Page Exit Analysis

Analysis of auto-save behavior, with emphasis on page-unload save and the blank-script bug.

---

## 1. Overview

Script content is persisted to the server by **EditorSaveService** only. **PersistenceManager** saves metadata and UI state to localStorage; it does not send script content to the API.

| Trigger | Handler | Effect |
|---------|---------|--------|
| `CONTENT_PERSIST` (typing, edits) | `handleContentChange` | Debounced 800ms → `flushSave('auto')` |
| `FOCUS_OUT` (blur) | `handleFocusOut` | Immediate `flushSave('focus')` |
| Toolbar save / Ctrl+S | `handleManualSave` | Immediate `flushSave('manual')` |
| ~~`beforeunload` / `pagehide`~~ | ~~`handlePageExit`~~ | **Removed** — server saves on unload disabled |

---

## 2. Page Exit Save — Problems

### 2.1 Blank Script Bug

**Observed:** A save on page exit creates a new version with minimal content (e.g. ~91 chars, one empty header line), overwriting the real script.

**Root cause (likely):** Previously, exit events could beat DOM→model sync. `beforeunload`/`pagehide` fires while the coordinator still has pending work in `_opQueue` or while the DOM hasn’t been re-ingested, so `content.getContent()` returns the initializer/stale minimal doc, and `flushSave('exit')` could ship it. **Ongoing risk:** Blank overwrites can still occur if non-unload save triggers fire during teardown or script switching while coordinator/model sync is behind (e.g. route change, focus changes from overlays/modals, programmatic CONTENT_PERSIST during teardown).

**Secondary causes:**

1. **Content source is unreliable** — `this.content.getContent()` reads from `EditorDocumentService.document`. That document can be:
   - Empty if `loadScript` was called with `script.content === ''` (e.g. from list cache, or before API returned).
   - Minimal if the editor was initialized with placeholder/default content.
   - Stale if the page is already tearing down and state is inconsistent.

2. **Guards can still pass** — A "blank" doc can slip through if: it is structurally valid (has `"lines"`), it’s not tiny (e.g. lots of empty lines push length > 200), and it differs from `lastNormalizedContent`. That matches "saved a new version that looks blank."

3. **`hasLoadedInitialContent` is misleading** — It is set to `true` after *any* successful `updateContent`, including when content is empty.

4. **List-item cache path** — `ScriptStore.loadScript` can use cached list items (from `loadScripts`) that have `content: ''`. That sets current script with empty content; editor loads it; exit-save persists it.

### 2.2 Unload Event Reliability

| Event | When it fires | Notes |
|-------|---------------|------|
| `beforeunload` | Tab close, navigate away, refresh | Synchronous only; async work (e.g. `fetch`) is not guaranteed to complete. |
| `pagehide` | Tab hidden or page unloading | Same constraints; better on mobile. |

**Implication (historical):** Even when exit save existed, `fetch` was not designed for unload; the PUT often wouldn't complete before the page terminated.

### 2.3 Unload Listeners

**EditorSaveService** no longer listens to `beforeunload`/`pagehide` (removed). **PersistenceManager** still does:

- **PersistenceManager.handleBeforeUnload** → `saveCurrentState()` → localStorage only (no script content).



---

## 3. Current Guards in `flushSave`

```js
// EditorSaveService.flushSave
if (!this.content.hasLoadedInitialContent()) return false;
if (!this.scriptStore.hasLoadedCurrentScript()) return false;
if (normalized.length < 200) return false;  // "suspiciously small"
if (!normalized.includes('"lines"')) return false;
if (normalized === this.lastNormalizedContent) return false;
if (currentScript && normalized === currentScript.content) return false;
```

**Gaps:**

- Empty or single-line content (~91 chars) should be blocked by the 200-char check. If the bug still occurs, either the guard was added after the incident or content passed as "valid" (e.g. many empty lines totaling &gt; 200 chars).
- `hasLoadedInitialContent` can be true with minimal content.
- No check that content came from a full API load, not from list/placeholder.

---

## 4. Is Page-Exit Save Worth Keeping?

### Arguments for removing unload save

1. **Unreliable execution** — Async requests often do not complete on unload.
2. **High risk, low benefit** — Exit handler can save blank/minimal content and overwrite good data. Recovery depends on version history.
3. **Existing coverage** — Focus-out and 800ms debounce usually persist changes before the user leaves.
4. **Simpler logic** — One fewer event and failure mode.

### Arguments for keeping it

1. **Catastrophic loss** — If the user never blurs the editor and closes the tab, the last 800ms of edits could be lost.
2. **Mobile** — `pagehide` can fire when the app goes to background; some users expect a "save on background."

### Recommendation (Implemented)

Unload listeners were removed from EditorSaveService. Server saves rely on:

- Debounced auto-save (800ms after last edit).
- Focus-out save.
- Manual save.

If exit save is reintroduced later, use `navigator.sendBeacon` with strict length/structure guards.

---

## 5. Other Potential Blank-Content Paths

| Path | Notes |
|------|-------|
| **ScriptSyncService** | Listens to `SCRIPT.CONTENT_CHANGED` (non-edit). Calls `updateScript` with `data.content`. If that event carries minimal content, it could overwrite. |
| **List script as current** | ~~If `currentScript` is ever set from a list item~~ **Fixed**: ScriptStore only uses cached script if `cached.content` is a non-empty string (trim check); otherwise fetches by id from API. Guards against placeholder list items and edge cases like `" "` or minimal templates. |
| **Persistence restore** | `restoreScriptState` sets `CURRENT_SCRIPT_ID` only; full script is loaded by ID. That path should return full content from API, unless there is a race. |

---

## 6. Implemented Changes

1. **Remove unload save (EditorSaveService)** ✓  
   - Removed `beforeunload` and `pagehide` listeners.  
   - Removed `handlePageExit`. Server saves now rely on debounce, focus-out, and manual save only.

2. **Fix list-item cache path (ScriptStore)** ✓  
   - Only use cached script if `cached.content` is a non-empty string (trim check). Otherwise fetch by id from API. This guards against placeholder list items (which have `content: ''`) and edge cases like `" "` or minimal templates.

3. **Keep PersistenceManager beforeunload**  
   - It only writes to localStorage (metadata, cursor, UI state). No script content. Low risk.

4. **Meaningful-content guard (ScriptStore)** ✓  
   - `hasMeaningfulContent()` computes non-whitespace chars and non-empty line count; blocks `queuePatch` when `meaningfulChars < 50` and `nonEmptyLines < 3`. Rejects "blank but long" payloads (e.g. 200 empty lines).

5. **Partial-bootstrap invariant (EditorSaveService)** ✓  
   - Block `flushSave` unless `hasLoadedCurrentScript()` OR `lastNormalizedContent` is set (prevents save during partial bootstrap).

6. **Skip empty content in updateScript** ✓  
   - Do not include `content` in update payload when formatted content is empty; avoids accidental overwrite with blank.

### Optional future improvements
- **Never save until full-load invariant** — Track `contentSource: 'api' | 'placeholder' | 'unknown'`. Block `flushSave` unless `contentSource === 'api'` OR at least one successful save has completed this session. Prevents any save from a partial-load state, regardless of trigger.
- **Stricter `flushSave` guards** — Require `lastNormalizedContent` from a prior successful save or full load.
- **sendBeacon fallback** — If exit save is reintroduced, use `sendBeacon` with strict length/structure checks.

---

## 7. File Reference

| File | Role |
|------|------|
| `public/js/widgets/editor/save/EditorSaveService.js` | `flushSave`; unload listeners removed |
| `public/js/stores/ScriptStore.js` | `queuePatch` (hasMeaningfulContent guard), `flushPatch`, `updateScript`; cache requires non-empty trimmed content |
| `public/js/services/persistence/PersistenceManager.js` | `handleBeforeUnload` → localStorage only |
| `public/js/widgets/editor/EditorCoordinator.js` | `hasLoadedInitialContent`, `getContent`, `_opQueue` |
| `public/js/widgets/editor/EditorDocumentService.js` | `getContent` from document model |
| `public/js/widgets/editor/EditorWidget.js` | `loadScript` → `updateContent(script.content)` |
