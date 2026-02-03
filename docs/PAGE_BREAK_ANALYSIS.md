# Page Break Analysis for AI Script Append

## Overview

This document analyzes how the editor handles page breaks when appending AI-generated script content, and identifies the root cause of content overflow issues.

**Status**: Root cause identified, fix implemented (chunked append).

---

## 1. Page Break Architecture

### Key Components (Fault Domain)

| Component | File | Responsibility |
|-----------|------|----------------|
| `PageManager` | `page/PageManager.js` | Tracks pages, enforces capacity, manages line-to-page mapping |
| `EditorRendererAdapter` | `handlers/EditorRendererAdapter.js` | Distributes lines across pages during render |
| `EditorRenderer` | `renderers.js` | Low-level DOM creation and page filling |
| `EditorCoordinator` | `EditorCoordinator.js` | Orchestrates commands and triggers renders |

**Note**: `PageBreakManager` handles manual page breaks only and is NOT causally involved in AI append overflow.

### Page Constants

```javascript
// constants.js
export const MAX_LINES_PER_PAGE = 22;
export const MAX_OVERFLOW = 0;
export const PAGE_MARGIN = 30;
export const PAGE_HEIGHT = 1056;     // ~11 inches at 96dpi
export const CONTENT_HEIGHT = 996;   // PAGE_HEIGHT - (PAGE_MARGIN * 2)
export const LINE_HEIGHT = 22;       // Standard line height in pixels
```

### CSS Page Constraints

```css
.editor-page {
    width: 8.5in;
    height: 11in;
    max-height: 11in;
    padding: 1in;
    overflow: hidden;  /* ⚠️ Content beyond height is clipped */
}

.editor-page-content {
    height: 100%;
    overflow: hidden;  /* ⚠️ Double overflow clipping */
}
```

---

## 2. Page Break Flow (AI Append)

```
┌─────────────────────────────────────────────────────────────────────┐
│  AI Response                                                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ { script: "<action>...</action>\n<speaker>..." }              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ScriptOrchestrator.handleScriptAppend()                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 1. normalizeScriptLines(content)                              │  │
│  │ 2. buildLineItem() for each line                              │  │
│  │ 3. Call EditorCoordinator.appendLines(lineItems)              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EditorCoordinator.appendLines()                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 1. Create ADD commands for each line                          │  │
│  │ 2. applyCommands(commands)                                    │  │
│  │    └─ DocumentService.applyCommands() (model mutation)        │  │
│  │    └─ renderController.renderDocument() (DOM render)          │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EditorRendererAdapter.renderDocument()                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 1. Calculate requiredPages = ceil(lines / maxLinesPerPage)    │  │
│  │ 2. ensurePageCapacity(requiredPages)                          │  │
│  │ 3. _renderWithLineReuse() or full rebuild                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Page Distribution (_renderWithLineReuse)                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ for each page:                                                │  │
│  │   for (i = 0; i < maxLinesPerPage && lineIndex < lines; i++)  │  │
│  │     fragment.appendChild(lineElement)                         │  │
│  │   content.appendChild(fragment)                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Root Problem: Line-Count vs Pixel-Height Mismatch

### Current Logic (Line-Count Based)

The page break system uses a **fixed line count** (`MAX_LINES_PER_PAGE = 22`) to determine when to break to a new page:

```javascript
// EditorRendererAdapter._renderWithLineReuse()
for (let i = 0; i < maxLinesPerPage && lineIndex < lines.length; i++, lineIndex++) {
    // Add line to page
}
// Move to next page after 22 lines
```

### Why This Causes Overflow

| Problem | Cause | Effect |
|---------|-------|--------|
| **Variable line heights** | Different formats have different CSS (padding, margins) | 22 lines of dialog ≠ 22 lines of action in height |
| **Text wrapping** | Long content wraps to multiple visual lines | 1 logical line = 2-3 visual lines |
| **Format-specific spacing** | Speaker has less margin than action | Unpredictable vertical space usage |
| **Fixed pixel height** | Page has `max-height: 11in` with `overflow: hidden` | Excess content is clipped, not visible |

### Visual Example

```
┌─────────────────────────────────────────┐
│  Page 1 (height: 11in, ~996px content)  │
├─────────────────────────────────────────┤
│  Line 1: <header> INT. ROOM - DAY       │  ~30px
│  Line 2: <action> Short action.         │  ~25px
│  Line 3: <speaker> DAVID                │  ~20px
│  Line 4: <dialog> Short dialog.         │  ~25px
│  ...                                    │
│  Line 20: <action> Very long action     │
│           that wraps to multiple        │  ~75px (3 visual lines!)
│           lines because of length.      │
│  Line 21: <speaker> FRIEND              │  ~20px
│  Line 22: <dialog> Another long dialog  │
│           that also wraps because...    │  ~50px
├─────────────────────────────────────────┤
│  ▼ HIDDEN (overflow: hidden) ▼          │
│  ... rest of line 22 content ...        │
└─────────────────────────────────────────┘
```

---

## 4. Code Paths That Trigger Page Breaks

### Path 1: Full Document Render

```javascript
// EditorRenderer.renderContentChunk() in renderers.js
const pageIsFull = linesInCurrentPage >= this.pageManager.maxLinesPerPage;

if (pageIsFull || isLastLine) {
    pageContent.appendChild(fragment);
    if (!isLastLine) {
        currentPageIndex++;
        currentPage = this.pageManager.pages[currentPageIndex];
        linesInCurrentPage = 0;
    }
}
```

### Path 2: Line-by-Line Addition (via PageManager)

```javascript
// PageManager.addLine() → PageOperations.addLine()
addLine (line, targetPageIndex, anchorLineId, pageLineCount, maxLinesPerPage) {
    if (pageLineCount >= maxLinesPerPage) {
        return [
            { type: 'ADD_PAGE' },
            { type: 'ADD_LINE', line, targetPageIndex: targetPageIndex + 1 }
        ];
    }
    return [{ type: 'ADD_LINE', line, anchorLineId, targetPageIndex }];
}
```

### Path 3: Post-Render Capacity Enforcement

```javascript
// PageManager._enforcePageCapacity()
while (lines.length > this.maxLinesPerPage) {
    const overflowLine = lines[lines.length - 1];
    let nextPage = this.pages[pageIndex + 1] || this._applyAddPage(null, batchState);
    nextContainer.insertBefore(overflowLine, nextContainer.firstChild);
}
```

**Note:** This only runs after PageManager operations, NOT after `EditorRendererAdapter` renders.

---

## 5. Inconsistency in `linesPerPage` Values

There's a hardcoded value that doesn't match the constant:

```javascript
// EditorRendererAdapter.updateContent() - line 153
const linesPerPage = 20;  // ⚠️ Hardcoded to 20!
const requiredPages = Math.ceil(lines.length / linesPerPage);

// vs everywhere else using:
this.pageManager.maxLinesPerPage  // = 22
```

This can cause page count miscalculation.

---

## 6. Recommended Fixes

### P0: Fix Hardcoded Lines-Per-Page ✅ DONE

```javascript
// EditorRendererAdapter.updateContent()
// Before:
const linesPerPage = 20;

// After:
const requiredPages = Math.ceil(lines.length / this.pageManager.maxLinesPerPage);
```

### P1: Chunked AI Append ✅ IMPLEMENTED

The highest-ROI fix. Append in smaller chunks that naturally trigger page evaluation:

```javascript
// ScriptOrchestrator.js
const AI_APPEND_CHUNK_SIZE = 22;  // Matches MAX_LINES_PER_PAGE

async _chunkedAppend(editorContent, lineItems, source) {
    let totalAppended = 0;
    
    for (let i = 0; i < lineItems.length; i += AI_APPEND_CHUNK_SIZE) {
        const chunk = lineItems.slice(i, i + AI_APPEND_CHUNK_SIZE);
        const result = await editorContent.appendLines(chunk, { source });
        
        if (!result.success) {
            return { success: false, linesAffected: totalAppended };
        }
        totalAppended += chunk.length;
    }
    
    return { success: true, linesAffected: totalAppended };
}
```

**Why this works:**
- Reuses existing page math
- No DOM measurement needed
- No new abstractions
- Each chunk triggers a full render cycle with page capacity checks
- Minimal risk

### P2: Post-Render Overflow Redistribution (Future)

If chunked append isn't sufficient, add overflow detection in `EditorRendererAdapter`:

```javascript
// Should live in EditorRendererAdapter, NOT PageManager
async _redistributeOverflowingContent() {
    const pages = this.pageManager.getPages();
    
    for (let i = 0; i < pages.length; i++) {
        const content = pages[i].querySelector('.editor-page-content');
        
        while (content.scrollHeight > content.clientHeight) {
            const lastLine = content.lastElementChild;
            if (!lastLine) break;
            
            let nextPage = pages[i + 1];
            if (!nextPage) {
                nextPage = await this.pageManager.createNewPage();
            }
            
            const nextContent = nextPage.querySelector('.editor-page-content');
            nextContent.insertBefore(lastLine, nextContent.firstChild);
        }
    }
}
```

**Note:** `_enforcePageCapacity` in PageManager is NOT a universal safety net - it's designed for PageManager-driven line ops, not post-render redistribution.

### P3: Pixel-Based Page Breaking (Future - Print Fidelity)

```javascript
_shouldBreakPage(pageContent, lineElement, maxContentHeight) {
    return (pageContent.scrollHeight + lineElement.offsetHeight) > maxContentHeight;
}
```

**Caveats:**
- Introduces layout thrash (DOM insertion → measurement → removal)
- Can get expensive with many pages
- Save for when print fidelity / export correctness become top-tier requirements

### Debug Aid Only: CSS Overflow (NOT a fix)

```css
.editor-page-content {
    overflow-y: auto;  /* Makes overflow visible */
}
```

**Warning:** This is a band-aid for debugging only. It breaks the mental model of screenplay pages and hides real bugs.

---

## 7. Why AI Append Was Especially Vulnerable

1. **Bulk addition**: AI appends 5-16 lines at once
2. **Unpredictable content length**: AI generates variable-length dialog
3. **No mid-batch reassessment**: Lines were added as a single batch, then rendered once
4. **Single render pass**: No opportunity for page math between lines
5. **Post-render enforcement skipped**: `_enforcePageCapacity` only runs for PageManager line operations

**Key insight**: The paging model was designed for humans (typing one line at a time), not bulk AI inserts. The fix is about **append strategy**, not rewriting the editor.

---

## 8. Implementation Status

| Priority | Fix | Status |
|----------|-----|--------|
| **P0** | Fix hardcoded `linesPerPage = 20` | ✅ Done |
| **P1** | Chunked AI append | ✅ Implemented |
| **P2** | Post-render overflow redistribution | Future (if needed) |
| **P3** | Pixel-based page breaking | Future (print fidelity) |

---

## 9. Testing Checklist

- [ ] Append 16 lines of short dialog → should fit on one page
- [ ] Append 16 lines of long action (wrapping) → should overflow to page 2
- [ ] Mixed content with varied formats → correct distribution
- [ ] Append to partially-filled page → overflow detection works
- [ ] Undo after page break → page count decreases correctly

---

## 10. Key Files

| File | Purpose |
|------|---------|
| `public/js/widgets/editor/constants.js` | `MAX_LINES_PER_PAGE`, page dimensions |
| `public/js/widgets/editor/page/PageManager.js` | Page lifecycle, capacity enforcement |
| `public/js/widgets/editor/handlers/EditorRendererAdapter.js` | Line distribution during render |
| `public/js/renderers.js` | `EditorRenderer.renderContentChunk()` |
| `public/css/components/editor.css` | Page styling, `overflow: hidden` |
