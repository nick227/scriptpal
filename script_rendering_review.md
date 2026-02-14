# Script Rendering Architecture Review

## Overview
This document outlines the architectural differences between the script editor (`/mine`) and the public script viewer (`/public`), analyzes code reuse, and evaluates the feasibility of implementing optional page breaks.

## Rendering Architecture

### 1. Editor (`/mine`)
- **Entry Point**: `public/js/widgets/editor/EditorWidget.js`
- **Core Orchestrator**: `PageManager.js`
- **Mechanism**: 
  - Dynamic, interactive DOM manipulation.
  - Uses an intent-based system (`_applyIntents`, `_applyAddPage`, `_applyAddLine`) to manage document structure.
  - Enforces page capacity via `PageOperations` and `_enforcePageCapacity`.
  - Supports manual page breaks via `PageBreakManager`.
- **Primary Goal**: WYSIWYG editing with real-time page flow calculation for PDF fidelity.

### 2. Public Viewer (`/public`)
- **Entry Point**: `public/js/pages/publicScriptViewerPage.js`
- **Mechanism**:
  - Static, one-time rendering (with potential reactivity for comments).
  - Fetches script content via API.
  - Parses content using `ScriptDocument`.
  - Chunks lines using `chunkLines`.
  - Creates page shells using `createPageShell`.
  - Redistributes content using `redistributeOverflowingContent` (shared utility).
- **Primary Goal**: Fast, read-only presentation.

## Code Reuse Strategy

Despite the divergent goals (editing vs. viewing), significant logic is shared:

1.  **`LineFormatter.js`**: Both systems use this to generate the HTML for individual script lines (Dialogue, Character, Action, etc.). This ensures consistent styling.
2.  **`ScriptDocument.js`**: Shared model for data parsing and serialization.
3.  **`utils/pageRedistribution.js`**: 
    - `createPageShell`: Creates the standardized `.editor-page` DOM structure.
    - `redistributeOverflowingContent`: Shared logic to handle content overflowing a page's height. This ensures the viewer matches the editor's pagination logic.
4.  **CSS**: Both rely on common classes (`.editor-page`, `.script-line`, `.page-break-indicator`) defined in main CSS files.

## Feasibility: Optional Page Breaks

The request to make page breaks "optional" (i.e., a continuous scrolling view) has different implications for each context:

### Public Viewer (`/public`) - **Low Complexity**
- **Approach**: 
  1. Instead of calling `chunkLines` and iterating through pages, render all `items` into a single container.
  2. Skip calling `redistributeOverflowingContent`.
  3. Use CSS to hide or visually merge `.editor-page` boundaries if we still use the page shell, or just use a single `.editor-page--continuous` container.
- **Effort**: Minimal. The viewer logic is linear and stateless regarding page structure.

### Editor (`/mine`) - **Medium to High Complexity**
- **Challenge**: `PageManager` is architected around the concept of discrete pages. It continuously monitors line counts and overflow to create new pages (`ensurePageCapacity`).
- **Approach A (Visual Only - Easiest)**: 
  - Keep the internal page structure (vital for ensuring Export to PDF works later) but use CSS to visually hide the gaps between pages (`margin-bottom: 0`, hide `box-shadow` or borders).
  - This "Continuous View" mode preserves the pagination logic under the hood but looks seamless to the user.
- **Approach B (True Continuous - Hard)**:
  - Refactoring `PageManager` to support a "no-pagination" mode where it doesn't enforce capacity.
  - This risks de-syncing the "view" from the "print/export" layout, meaning what the user sees isn't what they get when exporting.
- **Recommendation**: Implement **Approach A**. Add a class like `.editor-mode--continuous` to the container, and use CSS to merge the visual page boundaries.

## Recommendations for Implementation

1.  **Refactor Rendering Options**: Update `publicScriptViewerPage.js` to accept a `viewMode` parameter ('paged' vs 'continuous').
2.  **Shared Continuous Class**: Create a shared CSS utility class (e.g., `.script-viewer--continuous`) that removes page margins and shadows.
3.  **Editor Toggle**: Add a toggle in the Editor toolbar that switches between "Page View" and "Continuous View" by toggling the CSS class on the editor container.
