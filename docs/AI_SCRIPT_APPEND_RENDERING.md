# AI Script Append Rendering Flow

## Overview

This document traces how AI-generated script content flows from the chat response to the editor DOM.

---

## Data Flow Diagram

```
AI Response (raw text with tags)
       │
       ▼
ScriptOperationsHandler._handleScriptAppend()
       │  - validates AI response format
       │  - extracts raw content
       │  - optionally splits long lines
       ▼
ScriptOrchestrator.handleScriptAppend()
       │  - normalizeScriptLines() → splits by \n, trims, filters empty
       │  - buildLineItem() → parses tags, determines format
       │  - produces: Array<{format, content}>
       ▼
EditorCoordinator.appendLines()
       │  - creates ADD commands via documentService.createAddCommandAtIndex()
       │  - applyCommands() → updates document model
       ▼
EditorRenderController.renderDocument()
       │
       ▼
EditorRendererAdapter.renderDocument()
       │  - tries _tryInPlaceUpdate() first
       │  - tries _renderWithLineReuse() second
       │  - falls back to full rebuild
       ▼
EditorRenderer.renderContentChunk()
       │  - _createLineElement() for each line
       ▼
LineFormatter.createFormattedLine()
       │  - creates <div class="script-line format-{format}">
       │  - sets textContent
       ▼
DOM
```

---

## Stage 1: ScriptOperationsHandler

**File:** `public/js/widgets/chat/core/ScriptOperationsHandler.js`

**Method:** `_handleScriptAppend(data)`

### What it does:
1. Validates AI response format via `validateAiResponse()`
2. Extracts raw content from response
3. Sanitizes content
4. Optionally splits long lines via `orchestrator.splitLongAiLines()`
5. Passes to ScriptOrchestrator

### Input:
```javascript
{
  response: {
    metadata: { contract: 'APPEND_SCRIPT', ... },
    content: '<dialog>Hello world</dialog>\n<action>He walks away.</action>'
  }
}
```

### Potential Issues:
- **Validation may reject valid content** if metadata contract doesn't match
- **Content extraction** tries multiple paths (formattedScript, content, etc.)
- **Line length splitting** may break mid-word or mid-tag if not careful

---

## Stage 2: ScriptOrchestrator

**File:** `public/js/services/script/ScriptOrchestrator.js`

### normalizeScriptLines(content)
```javascript
// Input: "<dialog>Line 1</dialog>\n<action>Line 2</action>"
// Output: ["<dialog>Line 1</dialog>", "<action>Line 2</action>"]

String(content)
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0)
```

### buildLineItem(line)
```javascript
// 1. Normalize tag names (lowercase, fix spacing)
// 2. Try to parse as tagged: <format>content</format>
// 3. If not tagged, determine format heuristically
// 4. Return: { format, content }
```

### parseTaggedLine(line)
```javascript
// Regex: /^<([\w-]+)>([\s\S]*)<\/\1>$/
// Extracts format and content from tagged line
```

### Potential Issues:
- **Empty lines lost:** `filter(line => line.length > 0)` removes all empty lines
- **Whitespace trimmed:** `map(line => line.trim())` loses leading/trailing spaces
- **Self-closing tags:** `<chapter-break />` handled specially
- **Tag case normalization:** Multiple regex replacements may have edge cases
- **Heuristic format detection:** `determineContentFormat()` may misclassify

---

## Stage 3: EditorCoordinator.appendLines

**File:** `public/js/widgets/editor/EditorCoordinator.js`

```javascript
async appendLines(lines = [], options = {}) {
  return this._enqueueOperation(async () => {
    const startIndex = this.documentService.getLineCount();
    const commands = lines.map((line, index) => 
      this.documentService.createAddCommandAtIndex(startIndex + index, {
        format: line.format,
        content: line.content
      })
    ).filter(Boolean);
    
    const result = await this.applyCommands(commands, { source: 'append' });
    // ...
  });
}
```

### Command Creation
```javascript
// createAddCommandAtIndex returns:
{
  command: 'ADD',
  lineNumber: insertIndex,
  value: '<format>content</format>'  // serialized
}
```

### Potential Issues:
- **Index calculation:** All commands use same `startIndex`, but indices increment
- **Serialization round-trip:** Content is serialized to `<tag>content</tag>` then parsed again

---

## Stage 4: Document Model Update

**File:** `public/js/widgets/editor/EditorDocumentService.js`

### applyCommands()

For each ADD command:
1. Parse value: `/<([\w-]+)>([\s\S]*)<\/\1>/`
2. Insert into document model at index
3. Generate inverse commands for undo

### parseValue(value)
```javascript
const match = value.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
if (!match) {
  return { format: DEFAULT_FORMAT, content: value };
}
return {
  format: match[1].toLowerCase(),
  content: match[2]
};
```

### Potential Issues:
- **Regex may not match** if format has special characters or content has nested tags
- **Default format fallback** may cause unexpected formatting
- **Case normalization** happens here again (`.toLowerCase()`)

---

## Stage 5: Rendering

**File:** `public/js/widgets/editor/handlers/EditorRendererAdapter.js`

### Three Rendering Strategies:

#### 1. In-Place Update (`_tryInPlaceUpdate`)
- Fastest path
- Only works if DOM line count matches model line count
- Updates textContent and format classes directly
- **No DOM reconstruction**

#### 2. Line Reuse (`_renderWithLineReuse`)
- Reuses existing DOM elements by lineId
- Creates new elements only for new lines
- Removes elements for deleted lines
- **Partial DOM reconstruction**

#### 3. Full Rebuild
- Clears all page content
- Creates all elements from scratch
- Slowest path
- **Full DOM reconstruction**

### Line Element Creation

**File:** `public/js/renderers.js`

```javascript
_createLineElement(line) {
  const format = line.format || 'action';
  const lineElement = this.lineFormatter.createFormattedLine(format);
  
  if (line.id) {
    lineElement.dataset.lineId = line.id;
  }
  
  if (line.text) {
    lineElement.textContent = line.text;
  }
  
  return lineElement;
}
```

### Potential Issues:
- **Property naming inconsistency:** Model uses `content`, renderer expects `text`
- **Mapping required:** `{ id, format, text: line.content }`
- **In-place update** may not catch all format changes (class vs data-format mismatch)

---

## Stage 6: LineFormatter

**File:** `public/js/widgets/editor/LineFormatter.js`

```javascript
createFormattedLine(format) {
  const line = document.createElement('div');
  line.className = 'script-line';
  line.dataset.format = format;
  line.classList.add(`format-${format}`);
  line.contentEditable = 'true';
  // ... event handlers
  return line;
}
```

### Potential Issues:
- **Format validation** happens here again
- **Empty text node** added for cursor positioning (may affect rendering)
- **Event handlers attached** to every line (memory consideration)

---

## Known Rendering Issues

### 1. Format Inconsistency Between Data Attributes and Classes

Lines have both:
- `data-format="dialog"` (data attribute)
- `class="format-dialog"` (CSS class)

In-place updates may update one but not the other.

### 2. Content/Text Property Mismatch

Model uses:
```javascript
{ id, format, content }
```

Renderer expects:
```javascript
{ id, format, text }
```

Mapping happens in `EditorRendererAdapter.renderDocument()`:
```javascript
const lines = document.lines.map(line => ({
  id: line.id,
  format: line.format,
  text: line.content  // <-- mapping
}));
```

### 3. Empty Line Handling

- ScriptOrchestrator filters out empty lines
- This may lose intentional blank lines or paragraph breaks
- Chapter breaks (`<chapter-break />`) are handled specially

### 4. Multiple Format Validation Points

Format is validated at:
1. `ScriptOrchestrator.buildLineItem()` → `isValidFormat()`
2. `EditorDocumentService.createAddCommandAtIndex()` → `isValidFormat()`
3. `LineFormatter.createFormattedLine()` → `isValidFormat()`

Each may have different defaults or behaviors.

### 5. Serialization Round-Trip

Content goes through:
```
AI output → buildLineItem → {format, content}
→ createAddCommandAtIndex → "<format>content</format>"
→ applyCommands → parseValue → {format, content}
→ document model
```

This double-serialization may lose or corrupt data if content contains tag-like strings.

---

## Debugging Tips

### Enable Console Logging

ScriptOrchestrator logs:
```javascript
console.log('[ScriptOrchestrator] append line normalization', { normalizedLineCount });
console.log('[ScriptOrchestrator] append format breakdown', { formatCounts, sample });
console.log('[ScriptOrchestrator] formatting line', { rawLine, result });
```

### Check Format Breakdown

Look for format distribution in console:
```
formatCounts: { dialog: 5, action: 3, header: 1 }
```

### Verify DOM Structure

Inspect line elements for:
- `data-format` attribute
- `class="format-{format}"` class
- `data-line-id` attribute
- Correct `textContent`

---

## Recommendations

1. **Consolidate format validation** to single source of truth
2. **Remove double-serialization** - pass structured objects instead of tagged strings
3. **Handle empty lines explicitly** - don't filter them out silently
4. **Sync data-format and class** in a single place
5. **Add debug mode** that logs each transformation step
