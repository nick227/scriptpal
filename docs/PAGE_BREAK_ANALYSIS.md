# Page Break Analysis: Script Pages Lines-Per-Page Tracking

## Overview

This document analyzes how the editor determines line limits, tracks current lines and pages, and how three distinct content flows—**initial page rendering**, **live user carriage returns**, and **live AI-generated appending**—differ and align. It identifies why AI content may still exceed line limits and proposes solutions to stabilize AI appends.

---

## 1. Line Limit Determination

### Source of Truth

| Constant | File | Value |
|----------|------|-------|
| `MAX_LINES_PER_PAGE` | `public/js/widgets/editor/constants.js` | 22 |
| `AI_APPEND_CHUNK_SIZE` | `public/js/services/script/ScriptOrchestrator.js` | 22 (matches) |

```javascript
// constants.js
export const MAX_LINES_PER_PAGE = 22;

// PageManager.js - consumed at construction
this.maxLinesPerPage = MAX_LINES_PER_PAGE;
```

### How Line Limit Is Used

- **Page capacity**: `pageLineCount >= maxLinesPerPage` triggers a new page (PageOperations.addLine)
- **Required pages**: `Math.ceil(lines.length / maxLinesPerPage)` drives `ensurePageCapacity`
- **Chunk size**: AI append splits content into chunks of 22 to align with page math

---

## 2. Current Lines and Pages Tracking

### Document Model (Lines)

| Source | Method | Responsibility |
|--------|--------|----------------|
| EditorDocumentService | `getLineCount()` | Total logical lines |
| EditorDocumentService | `getLines()` | Array of line objects |
| EditorDocumentService | `getLineIndex(lineId)` | Index for a given line |

### Page Model (Pages and Mapping)

| Source | Method | Responsibility |
|--------|--------|----------------|
| PageManager | `pages` | Array of page DOM elements |
| PageManager | `getPageCount()` | Number of pages |
| PageManager | `getCurrentPage()` | Currently focused page |
| PageManager | `_getLineCountInPage(page)` | `.script-line` count in a page |
| PageManager | `_lineToPageIndex` | Map of lineId → pageIndex |
| PageManager | `_rebuildLineMap()` | Rebuilds line→page mapping |

### Line Count Per Page (DOM-Based)

```javascript
// PageManager._getLineCountInPage
const container = page.querySelector('.editor-page-content');
return container ? container.querySelectorAll('.script-line').length : 0;
```

The line limit is enforced by **logical line count**, not pixel height. One logical line can span multiple visual lines due to wrapping.

---

## 3. Three Content Flows: Comparison

### 3.1 Initial Page Rendering

**Entry points**: Load script, `EditorRendererAdapter.renderDocument()` or `updateContent()`

**Flow**:
1. `requiredPages = Math.ceil(lines.length / maxLinesPerPage)`
2. `ensurePageCapacity(requiredPages)` — ensures enough pages exist
3. Try `_tryInPlaceUpdate` (fails if line count differs)
4. Try `_renderWithLineReuse` or fallback to `renderContentChunk`

**Line distribution** (`renderContentChunk` in `renderers.js`):
```javascript
for (let i = 0; i < lines.length; i++) {
    fragment.appendChild(lineElement);
    linesInCurrentPage++;
    const pageIsFull = linesInCurrentPage >= this.pageManager.maxLinesPerPage;
    if (pageIsFull || isLastLine) {
        pageContent.appendChild(fragment);
        if (!isLastLine) {
            currentPageIndex++;
            currentPage = this.pageManager.pages[currentPageIndex];
            linesInCurrentPage = 0;
        }
    }
}
```

**Page break trigger**: `linesInCurrentPage >= maxLinesPerPage` or last line.

---

### 3.2 Live User Carriage Return (Enter Key)

**Entry points**: `KeyboardManager._handleEnter` → `KeyboardEditController.handleEnter` → `contentManager.insertLineAfter()`

**Flow**:
1. `createAddCommandAfterLine(lineId, { format, content })`
2. `documentService.applyCommands(commands)` — mutates model
3. Decide incremental vs full render:
   - `canIncremental = wasLastLine && requiredPages === currentPages`
4. **If incremental**: `renderController.appendLine(newLine)`
5. **If full render**: `renderController.renderDocument(document)`

**Incremental path** (`EditorRendererAdapter.appendLine`):
```javascript
const lastPage = pages[pages.length - 1];
const contentContainer = lastPage.querySelector('.editor-page-content');
contentContainer.appendChild(lineElement);  // No page capacity check
```

**When incremental is safe**: `requiredPages === currentPages` ensures adding one line will not push total line count past the current page capacity, so the last page will not exceed 22 lines.

**When full render runs**: If inserting after the last line would require a new page (`requiredPages > currentPages`), a full render runs and redistributes all lines across pages.

---

### 3.3 Live AI-Generated Appending

**Entry points**: `ScriptOperationsHandler._handleScriptAppend` or `handleAiDelta({ operation: 'append' })` → `ScriptOrchestrator._chunkedAppend`

**Flow**:
1. `normalizeScriptLines(content)` → array of line items
2. Chunk by `AI_APPEND_CHUNK_SIZE` (22)
3. For each chunk: `editorContent.appendLines(chunk, { source })`
4. `appendLines` → `applyCommands(ADD commands)` → `renderDocument(document)`

**Render path** (no incremental append for AI):
- `_tryInPlaceUpdate`: fails (line count changed)
- `_renderWithLineReuse` or full rebuild
- Both respect `maxLinesPerPage` when distributing lines

**Chunked append**:
```javascript
for (let i = 0; i < lineItems.length; i += AI_APPEND_CHUNK_SIZE) {
    const chunk = lineItems.slice(i, i + AI_APPEND_CHUNK_SIZE);
    const result = await editorContent.appendLines(chunk, { source });
    // Each chunk triggers full renderDocument with entire document
}
```

Each chunk causes a **full document render** (model already has all previous chunks + current chunk), so distribution is recomputed from the full line list.

---

## 4. Summary: Same vs Different

| Aspect | Initial Render | User Carriage Return | AI Append |
|--------|----------------|----------------------|-----------|
| Entry | load/updateContent | insertLineAfter | appendLines (chunked) |
| Model mutation | Full document | Single ADD | Multiple ADDs per chunk |
| Render path | _renderWithLineReuse or renderContentChunk | appendLine OR renderDocument | renderDocument only |
| Page capacity check | Yes (pageIsFull, maxLinesPerPage loop) | appendLine: No (safe via canIncremental) | Yes (full render) |
| Line-by-line vs batch | Batch | Single line | Batch (22 per chunk) |
| Distribution logic | Iterate pages, cap at 22/page | Append to last page or full rebuild | Same as initial |

**Common**: All flows eventually use the same distribution logic when doing a full render (`_renderWithLineReuse` or `renderContentChunk`).

**Difference**: User carriage return can use `appendLine` (no capacity check) when `canIncremental` is true; AI always goes through full render.

---

## 5. Why AI Content Still Exceeds Line Limits

### 5.1 Line-Count vs Pixel-Height Mismatch (Primary)

The system uses a fixed **logical line count** (22) per page. It does not measure actual pixel height.

- Long action or dialogue lines **wrap** and occupy multiple visual lines
- Different formats have different padding/margins (speaker vs action)
- `overflow: hidden` on `.editor-page-content` hides overflow

Result: 22 logical lines can exceed the visible page height, so content is clipped even when the line limit is respected.

### 5.2 Chunk Boundary on Partially-Filled Pages

When the last page has, e.g., 21 lines and a chunk of 22 is appended:
- Total = 43 lines → `requiredPages = 2`
- `_renderWithLineReuse` should distribute 22 + 21 correctly

If `ensurePageCapacity` or `_renderWithLineReuse` has a timing or ordering bug, overflow could occur. The current code appears sound, but this is a sensitive path.

### 5.3 Alternative AI Paths Without Chunking

- **EditorCommandExecutor.handleAppendCommand**: Adds one line via `_applyCommands` → full render. Safe.
- **handleAiDelta** with `position: 'end'`: Uses `_chunkedAppend`. Safe.
- **handleScriptAppend**: Uses `_chunkedAppend`. Safe.

All known AI append paths use chunked append or full render. No direct use of `appendLine` for AI content was found.

### 5.4 Race or Queue Issues

`_enqueueOperation` in EditorCoordinator serializes operations. If a second append starts before the first render completes, the queue should still serialize correctly. Worth verifying in high-load scenarios.

### 5.5 `_renderWithLineReuse` and Page Count

`_renderWithLineReuse` clears all page content and redistributes. If `ensurePageCapacity` adds new pages asynchronously, there could be a window where `getPages()` returns a stale list. The code suggests `ensurePageCapacity` is synchronous; this should be confirmed.

---

## 6. Ideal Solutions to Stabilize AI Content Appends

### P0: Ensure Single Source for Line Limit (Verify)

- Import `MAX_LINES_PER_PAGE` from `constants.js` everywhere
- Remove any hardcoded values (historical `linesPerPage = 20` is documented as fixed)
- `ScriptOrchestrator` should import `MAX_LINES_PER_PAGE` instead of duplicating 22

### P1: Chunk Size Alignment (Verify)

- Confirm `AI_APPEND_CHUNK_SIZE === MAX_LINES_PER_PAGE`
- Use a shared constant to avoid divergence

### P2: Post-Render Overflow Redistribution (Future)

Add overflow detection after render:

```javascript
// In EditorRendererAdapter, after _renderWithLineReuse or renderContentChunk
async _redistributeOverflowingContent() {
    const pages = this.pageManager.getPages();
    for (let i = 0; i < pages.length; i++) {
        const content = pages[i].querySelector('.editor-page-content');
        while (content.scrollHeight > content.clientHeight) {
            const lastLine = content.lastElementChild;
            if (!lastLine) break;
            const nextPage = pages[i + 1] || await this.pageManager.createNewPage();
            const nextContent = nextPage.querySelector('.editor-page-content');
            nextContent.insertBefore(lastLine, nextContent.firstChild);
        }
    }
}
```

This addresses pixel overflow when logical line count is within limits.

### P3: Conservative Chunk Size (Quick Win)

Use `AI_APPEND_CHUNK_SIZE = 18` (or `MAX_LINES_PER_PAGE - 4`) to leave room for wrapping. More frequent renders, but lower risk of visual overflow.

### P4: Pixel-Based Page Breaking (Long-Term)

Use `scrollHeight` and `clientHeight` to decide when to break:

```javascript
_shouldBreakPage(pageContent, lineElement, maxContentHeight) {
    return (pageContent.scrollHeight + lineElement.offsetHeight) > maxContentHeight;
}
```

Requires layout measurement; best used when print fidelity becomes a priority.

### P5: Disable Incremental Append When Last Page Is Full

In `EditorCoordinator.insertLineAfter`, add an explicit check:

```javascript
const lastPageLineCount = this.pageManager._getLineCountInPage(lastPage);
const canIncremental = wasLastLine && requiredPages === currentPages 
    && lastPageLineCount < this.pageManager.maxLinesPerPage;
```

This prevents any edge case where `appendLine` is used when the last page is already at capacity.

---

## 7. Key Files Reference

| File | Role |
|------|------|
| `public/js/widgets/editor/constants.js` | MAX_LINES_PER_PAGE, page dimensions |
| `public/js/widgets/editor/page/PageManager.js` | Page lifecycle, _getLineCountInPage, _enforcePageCapacity |
| `public/js/widgets/editor/page/PageOperations.js` | addLine intent (ADD_PAGE when page full) |
| `public/js/widgets/editor/handlers/EditorRendererAdapter.js` | renderDocument, _renderWithLineReuse, appendLine |
| `public/js/renderers.js` | EditorRenderer.renderContentChunk (pageIsFull logic) |
| `public/js/widgets/editor/EditorCoordinator.js` | appendLines, applyCommands, insertLineAfter |
| `public/js/services/script/ScriptOrchestrator.js` | _chunkedAppend, AI_APPEND_CHUNK_SIZE |

---

## 8. Testing Checklist

- [ ] Append 22 lines of short dialog → fits on one page
- [ ] Append 22 lines of long action (wrapping) → may overflow; verify post-render redistribution if implemented
- [ ] Append to page with 21 lines → overflow to page 2
- [ ] User Enter on line 22 → full render, new page
- [ ] User Enter on line 21 → incremental append, no new page
- [ ] Chunked AI append (44 lines) → two pages, 22 each
- [ ] Undo after page break → page count decreases correctly
- [ ] Shared constant for MAX_LINES_PER_PAGE and AI_APPEND_CHUNK_SIZE
