# Performance Proposal

This proposal targets loop efficiency, memory churn, and control flow clarity in the editor and related data paths. It focuses on in-place updates, reduced DOM traversal, and simplified data flow.

## Goals

- Reduce DOM traversals and reflows during editing.
- Cut repeated allocations and unnecessary transformations.
- Simplify update paths so focus/selection and rendering remain stable.

## Current Hotspots

### 1. Repeated DOM traversals

Multiple code paths repeatedly call `querySelectorAll('.script-line')` during a single update.

**Examples**
- `EditorDOMHandler.getContent()`
- `EditorDOMHandler._rebuildLineElementMap()`
- `EditorDOMHandler._tryInPlaceUpdate()`
- `EditorContent.ensureLineId()`

**Impact**
- Repeated full DOM walks during typing/render.
- CPU spikes and selection instability.

### 2. Redundant content serialization

`getContent()` is called multiple times in the same method after a single change.

**Examples**
- `EditorContent.updateContent()`: emits serialized content twice.
- `EditorContent` insert/append/prepend: serialize multiple times per operation.

**Impact**
- Unnecessary JSON string creation.
- Extra GC pressure during fast typing.

### 3. Full map rebuild after every render

`lineElementMap` is cleared and rebuilt across all lines on each render.

**Examples**
- `EditorDOMHandler._rebuildLineElementMap()` invoked in `renderDocument()`.

**Impact**
- O(n) DOM walk per render.
- Extra allocations for map entries.

### 4. Array copying in ScriptStore

`[...this.scripts]` creates new arrays on each update even when immutability is not required.

**Examples**
- `loadScripts`, `applyPatchLocally`, `updateScriptInCache`, `deleteScript`

**Impact**
- O(n) allocations per change.
- Extra GC during frequent updates.

### 5. Unnecessary transformations in render pipeline

Document lines are mapped into new arrays before rendering even when structure already matches the renderer’s needs.

**Example**
- `EditorDOMHandler.renderDocument()` maps `document.lines` to `{ id, format, text }`.

**Impact**
- Repeated allocations per render.
- Extra CPU for trivial field mapping.

## Proposed Structural Changes

### A. Make `lineElementMap` authoritative

**Change**
- Update the map incrementally on append/remove/update.
- Only rebuild when a full re-render is unavoidable.

**Effect**
- Removes repeated DOM scans during normal editing.
- Makes `getContent()` and `ensureLineId()` faster with map-based lookups.

### B. Serialize once per change

**Change**
- Store `const contentValue = this.getContent()` once per operation and reuse.
- Avoid calling `getContent()` multiple times in the same method.

**Effect**
- Reduced JSON serialization and GC churn.
- Clearer, deterministic event payloads.

### C. Render with in-place data where possible

**Change**
- Pass `document.lines` directly to rendering logic.
- Avoid mapping to new arrays unless the renderer requires a different shape.

**Effect**
- Eliminates per-render allocations.
- Shortens data path and simplifies flow.

### D. Reduce ScriptStore array cloning

**Change**
- Update `this.scripts` in place and call `setState` once per batch.
- Reserve copies for cases that truly require immutability.

**Effect**
- Fewer O(n) allocations per update.
- Reduced GC spikes when scripts update frequently.

### E. Remove redundant validation passes

**Change**
- Use cached references for `PageManager.validateState()` and only validate on structural changes.
- Avoid repeated `querySelectorAll` for page scans.

**Effect**
- Lower render overhead during large scripts.

## Proposed Execution Order

1. **In-place content serialization** (safe, low risk).
2. **Incremental `lineElementMap` updates** (medium risk, big gain).
3. **Render pipeline mapping reduction** (medium risk).
4. **ScriptStore array cloning reduction** (safe, medium gain).
5. **Page validation optimization** (lower impact).

## Success Criteria

- No observable cursor jumps during typing.
- Reduced CPU usage during typing and formatting.
- Lower GC activity under sustained edits.
- Stable selection during background content updates.

## Next Step

If approved, I’ll implement the changes starting with content serialization and line map updates, then proceed to render-path simplification.
