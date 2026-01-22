# Refactor Review: Editor Performance Optimizations

## Summary of Optimizations Applied

### Reduced Per-Keystroke Work
- Debounced full content emission on input to avoid serializing the entire script on every keystroke.
- Avoided unnecessary `ScriptDocument` updates when DOM content matches current state.

### Lowered DOM Churn
- Added an in-place update path in `EditorDOMHandler.renderDocument` that updates lines when IDs and counts match, skipping full clears and re-renders.
- Ensured page capacity via append-first logic and avoided full page teardown in normal paths.
- Reduced redundant page provisioning in the renderer when pages already exist.
- Centralized and guarded page content clearing to skip empty containers.

### Reduced Memory/CPU Overhead
- Removed fragment cloning in render batches to avoid duplicated node creation.
- Avoided `Array.from(...).indexOf(...)` allocations for line ID discovery.
- Added cached validation results in `EditorSaveService` to skip repeated DOMParser runs.
- Added cached serialization in `ScriptDocument.toContentString` with dirty tracking.
- Converted verbose keyboard logging to a gated debug mode.

### Index Maintenance Improvements
- Replaced full index rebuilds in `ScriptDocument` with incremental updates on insert/remove/replace.
- Adjusted dirty flags to only flip when content actually changes.

## Observed Impact

- Lower CPU utilization during long-form typing due to reduced serialization and DOM work.
- Less GC pressure by cutting temporary arrays, clones, and repeated parsing.
- Smoother updates under edit commands thanks to in-place rendering.

## Suggested Next Passes

Priority order for next passes:
1. Delta rendering by line IDs (do next): Enables safe insert/delete/reorder, required for AI page-level updates, and required for undo correctness.
2. Page-aware incremental layout: Performance polish that prevents cascading reflows.
3. Kill remaining DOM scans: Stability + speed, reduces accidental re-sync bugs.
4. Save pipeline improvements: Needed once scripts get large, especially with autosave + AI.
5. Global debug throttling: Cleanup, not urgent.

### 1) Delta Rendering by Line IDs
Current in-place updates require the DOM order to match line order. For reorder/insert/delete scenarios, introduce a small ID-to-element map and only re-render the affected segments.

Ideas:
- Maintain `Map<lineId, HTMLElement>` in `EditorDOMHandler` during render.
- For insert/delete, splice the DOM directly and update the map.
- Only rebuild pages if the update crosses page boundaries.

### 2) Page-Aware Incremental Layout
When line count changes, reflow only the impacted page and the next page until stable, instead of clearing all pages.

Ideas:
- Keep a `pageLineCounts` cache to detect boundary overflow.
- Adjust one page at a time with a small carry buffer.

### 3) Remove Remaining Full DOM Traversals
There are still paths that scan the DOM for `.script-line` or `.editor-page` frequently.

Ideas:
- Cache pages in `PageManager` and avoid repeated `querySelectorAll` unless DOM mutations are detected.
- Use MutationObserver to update caches when needed.

### 4) Save Pipeline Improvements
Autosave currently validates the full content string on each save.

Ideas:
- Validate only changed lines or run validation in a worker.
- Track a hash of the last validated content instead of raw string.

### 5) Throttle Debug Diagnostics Globally
Consolidate debug flags into a single editor-wide debug setting and pass it down via options.

## Risk Notes

- In-place updates depend on line ID stability; ensure IDs are never duplicated or dropped during import.
- Incremental page updates require careful handling of line breaks and line height variance.

## Invariant (Strongly Recommended)

ScriptDocument is the only place allowed to know "what exists." The DOM should only reflect it.
If any code path violates this, performance and correctness will drift apart.

## Files Touched
- `public/js/widgets/editor/EditorContent.js`
- `public/js/widgets/editor/handlers/EditorDOMHandler.js`
- `public/js/widgets/editor/model/ScriptDocument.js`
- `public/js/widgets/editor/page/PageManager.js`
- `public/js/renderers.js`
- `public/js/widgets/editor/save/EditorSaveService.js`
- `public/js/widgets/editor/keyboard/KeyboardManager.js`
