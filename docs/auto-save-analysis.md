# Script Editor Auto-Save Analysis

Analysis of how the script editor UI handles auto-save: triggers, processes, and call chains.

---

## 1. Overview

Auto-save for script **content** is handled by two layers:

| Layer | Purpose | Destination |
|-------|---------|-------------|
| **EditorSaveService** | Editor content → server | ScriptStore → API |
| **PersistenceManager** | App context (script id, cursor, chat, UI) → local | localStorage |

Only **EditorSaveService** persists script body to the server. **PersistenceManager** does not send script content; it persists metadata and UI state to localStorage on a 30s interval and on lifecycle events.

---

## 2. Editor Content Auto-Save (Server)

### 2.1 Entry: Content-Persist Pipeline

Script content save is driven by the event **`EDITOR_EVENTS.CONTENT_PERSIST`** (`'contentPersist'`).

**Emit path:**

1. **EditorCoordinator** (`EditorCoordinator.js`) – any content-changing action eventually calls **`_emitContentChange({ source })`** (lines 259, 383, 676, 729, 768).
2. **`_emitContentChange`** (lines 830–848):
   - Emits `CONTENT_CHANGE` and `contentChanged`, and runs `callbacks.onChange` if set.
   - Emits **`CONTENT_PERSIST`** immediately with the current `content` (from `this.getContent()`). Coordinator only signals; no debounce here.

So **triggers** for CONTENT_PERSIST are any code path that calls `_emitContentChange`, including:

- DOM sync after external content update (`syncLineContentFromDOM` → content update → `_emitContentChange`).
- Batch edit results (e.g. line insert/delete/merge) at lines 676, 729, 768.
- Programmatic content updates (e.g. line 259) and other edit intents that end in `_emitContentChange` (e.g. line 383).

**File / symbol reference:**

- `public/js/widgets/editor/constants.js`: `CONTENT_PERSIST: 'contentPersist'`.
- `public/js/widgets/editor/EditorCoordinator.js`: `_emitContentChange` (emits CONTENT_PERSIST immediately).

### 2.2 EditorSaveService Subscription and Flow

**EditorSaveService** (`public/js/widgets/editor/save/EditorSaveService.js`) is the only listener that turns CONTENT_PERSIST into a server save.

**Setup (EditorWidget.js):**

- `content` = EditorCoordinator (exposed as content manager).
- `saveService` is created with `content`, `toolbar`, `scriptStore` (no direct API; persistence goes through ScriptStore).

**Listeners (EditorSaveService.setupListeners):**

| Event / hook | Handler | Effect |
|--------------|---------|--------|
| `EDITOR_EVENTS.CONTENT_PERSIST` | `handleContentChange` | `flushSave('auto')` immediately. |
| `EDITOR_EVENTS.FOCUS_OUT` | `handleFocusOut` | `flushSave('focus')`. |
| Toolbar save button | `handleManualSave` | `flushSave('manual')`. |
| `beforeunload` / `pagehide` | `handlePageExit` | `flushSave('exit')`. |

**Call chain (no timers):**

1. **`handleContentChange()`** – calls **`flushSave('auto')`** immediately.

2. **`flushSave(reason)`**
   - Gets `scriptId` from `scriptStore.getCurrentScriptId()`; if none, returns false.
   - Gets content from `content.getContent()`, **normalizes** with `scriptStore.normalizeContent`.
   - If normalized === `lastNormalizedContent` or === current script’s normalized content, returns false.
   - Updates `lastNormalizedContent`.
   - **`this.scriptStore.queuePatch(scriptId, { content: normalized }, 'editor')`**.
   - **`this.scriptStore.flushPatch(scriptId)`** – sends to server immediately.

ScriptStore does not self-schedule; callers (EditorSaveService, TitlePageManager) call `flushPatch` after `queuePatch`.

---

## 3. ScriptStore Patch Queue (Actual Server Persistence)

**EditorSaveService** never calls the API directly. It calls **`scriptStore.queuePatch(scriptId, { content }, 'editor')`** then **`scriptStore.flushPatch(scriptId)`** so ScriptStore acts as transport only (no extra delay).

**ScriptStore** (`public/js/stores/ScriptStore.js`):

- **`queuePatch(scriptId, patch, reason)`** (lines 386–412):
  - Builds effective patch (e.g. merges with current script).
  - Merges into existing queue entry for `scriptId`.
  - **`applyPatchLocally(scriptId, existing.patch)`** – updates in-memory script.
  - **`emitSaveState(scriptId, 'SAVE_DIRTY', { reason })`** – UI can show dirty state.
  - Does **not** call `schedulePatchFlush`; callers must call **`flushPatch(scriptId)`** themselves.

- **`flushPatch(scriptId)`** (lines 457–524):
  - Logs `console.debug('[ScriptStore] flushPatch', { scriptId, hasContent, contentLength })` for diagnostics.
  - Builds full payload (title, author, description, content, versionNumber, visibility) from current script + queued patch.
  - **`await this.updateScript(scriptId, payload)`** – this is the **only place** script content is sent to the server (via **`this.api.scripts.updateScript(id, updateData)`**).

**Final save pipeline** (single straight line):

Keystroke / edit → EditorCoordinator._emitContentChange() → CONTENT_PERSIST → EditorSaveService.handleContentChange() → flushSave() → scriptStore.queuePatch() → scriptStore.flushPatch() → **API**. No debounce, no ScriptStore self-scheduling.

---

## 4. PersistenceManager (LocalStorage Only)

**PersistenceManager** (`public/js/services/persistence/PersistenceManager.js`) runs a **separate** auto-save that does **not** send script content to the server.

**Process:**

- **`startAutoSave()`** (lines 466–476): called from `initialize()`.
  - **`setInterval(async () => await this.saveCurrentState(), this.autoSaveDelay)`** with **`autoSaveDelay = 30000`** (30 s).

- **`saveCurrentState()`** (lines 422–442):
  - Gets current script from `stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT)`.
  - If present, calls **`handleScriptChange(currentScript)`**.
  - Calls **`handleUIStateChange({})`**.

- **`handleScriptChange(script)`** (lines 135–181):
  - Builds a **snapshot** (scriptId, cursorPosition, scrollPosition, title, author, description, visibility) – **no script body**.
  - Writes to **localStorage** via `saveToStorage` (e.g. `CURRENT_SCRIPT_ID`, `CURRENT_SCRIPT_STATE`, cursor/scroll keys).
  - Publishes `SCRIPT_STATE_SAVED`.

**Other triggers for PersistenceManager state save:**

- **`handleBeforeUnload`** (from `beforeunload`): calls `saveCurrentState()` and `saveSessionData()`.
- **`handleVisibilityChange`**: when `document.hidden`, calls `saveCurrentState()`; when visible again, loads persisted state.

**Public helpers** `autoSaveScriptState`, `autoSaveChatState`, `autoSaveUIState` (lines 849–866) delegate to `saveScriptState`, `saveChatState`, `saveUIState`; they are used by tests or other callers and do not change the fact that the 30s interval runs `saveCurrentState()` only.

---

## 5. Summary Table: Triggers and What They Call

| Trigger | Component | What runs | Eventually calls |
|--------|-----------|-----------|-------------------|
| Any content change (DOM sync, batch edits, etc.) | EditorCoordinator | `_emitContentChange` → `CONTENT_PERSIST` (immediate) | EditorSaveService.handleContentChange → flushSave → queuePatch + flushPatch |
| Focus leaves script line | EditorCoordinator | `FOCUS_OUT` | EditorSaveService.handleFocusOut → flushSave('focus') |
| Toolbar save / Ctrl+S | EditorToolbar / shortcuts | save handler | EditorSaveService.handleManualSave → flushSave('manual') |
| beforeunload / pagehide | Window | handlePageExit | EditorSaveService.flushSave('exit') |
| Every 30 s | PersistenceManager | setInterval | saveCurrentState → handleScriptChange + handleUIStateChange → localStorage only |
| Tab hidden | document | visibilitychange | PersistenceManager.handleVisibilityChange → saveCurrentState |

---

## 6. File Reference

| File | Role |
|------|------|
| `public/js/widgets/editor/constants.js` | `EDITOR_EVENTS.CONTENT_PERSIST`, `FOCUS_OUT` |
| `public/js/widgets/editor/EditorCoordinator.js` | Emits CONTENT_PERSIST immediately from _emitContentChange, FOCUS_OUT |
| `public/js/widgets/editor/save/EditorSaveService.js` | No timers; handleContentChange → flushSave; queuePatch + flushPatch immediately |
| `public/js/widgets/editor/keyboard/KeyboardEditController.js` | handleEnter → insertLineAfter only |
| `public/js/widgets/editor/EditorWidget.js` | Builds EditorSaveService (content = Coordinator, scriptStore) |
| `public/js/widgets/editor/title/TitlePageManager.js` | queuePatch + flushPatch after its own persist delay |
| `public/js/stores/ScriptStore.js` | queuePatch (no self-schedule), flushPatch, updateScript → API |
| `public/js/services/persistence/PersistenceManager.js` | 30 s interval saveCurrentState → localStorage |

**Removed:** `EditorAutosave.js` (deleted); save path is EditorSaveService only.
