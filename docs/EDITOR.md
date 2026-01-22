# Script Editor Widget Documentation

## Overview

The Script Editor Widget is a modular, component-based editor designed for managing script pages and page breaks. It follows a clean architecture pattern, separating concerns into orchestration, rendering, and specific feature management.

## Architecture

The editor is built around a central **Controller** that manages specialized helper classes. This separation of concerns ensures that the code remains maintainable and that specific functionalities (like rendering pages or handling page breaks) are decoupled.

### Core Components

1.  **EditorController (`EditorController.js`)**
    *   **Role**: The main entry point and orchestrator.
    *   **Responsibilities**:
        *   Initializes the editor components.
        *   Manages the lifecycle (setup, teardown) of the editor.
        *   Provides a public API for external interaction (add/remove pages, insert breaks).
        *   Links the internal managers to the DOM container.
    *   **Inheritance**: Extends a base `Controller` class.

2.  **PageRenderer (`PageRenderer.js`)**
    *   **Role**: Handles the DOM manipulation for script pages.
    *   **Responsibilities**:
        *   Creates and appends page elements.
        *   Updates page content efficiently.
        *   Removes pages from the DOM.
        *   Maintains a mapping of Page IDs to their DOM elements.  

3.  **PageBreakManager (`PageBreakManager.js`)**
    *   **Role**: Manages script page breaks.
    *   **Responsibilities**:
        *   Creates visual page break indicators.
        *   Inserts breaks at specific positions in the DOM.
        *   Handles interaction events (click, double-click) on breaks.
        *   Ensures proper cleanup of event listeners to prevent memory leaks.

## File Structure

```text
Editor/
├── EditorController.js  # Main controller
├── PageRenderer.js      # Page rendering logic
└── PageBreakManager.js  # Page break management
```

## detailed Component Analysis

### EditorController
The `EditorController` initializes by selecting a container element (`.editor-container`). It then instantiates its dependencies:
```javascript
this.pageRenderer = new PageRenderer(this.container);
this.pageBreakManager = new PageBreakManager(this.container);
```

**Key Lifecycle Methods:**
*   `onEnter()`: Sets up the container and components.
*   `onExit()`: Calls `cleanup()` to remove elements and listeners.

**Key API Methods:**
*   `addPage(page)`: Delegates to `PageRenderer`.
*   `insertPageBreak(id, position, label)`: Delegates to `PageBreakManager`.

### PageRenderer
The `PageRenderer` focuses solely on the visual representation of pages. It expects a `page` object with `id` and `content` properties.

**DOM Structure Created:**
```html
<div class="page" data-page-id="...">
    <div class="page-content">...</div>
</div>
```

### PageBreakManager
The `PageBreakManager` handles the distinct visual element of a page break. It supports interactive events, which is useful for selecting or modifying breaks.

**DOM Structure Created:**
```html
<div class="page-break" data-page-break-id="...">
    <div class="page-break-indicator">PAGE BREAK</div>
</div>
```

**Event Handling:**
It internally manages `click` and `dblclick` events, storing references to the handler functions so they can be properly removed during destruction.

## Usage Example

```javascript
// 1. Initialize Controller
const editor = new EditorController();
editor.onEnter();

// 2. Add Content
editor.addPage({ id: 'p1', content: 'INT. COFFEE SHOP - DAY' });
editor.addPage({ id: 'p2', content: 'Alice sips her coffee.' });

// 3. Insert specific Page Break
editor.insertPageBreak('brk1', 1, 'End of Scene 1');

// 4. Cleanup when done
editor.onExit();
```
