# Outlines Feature Plan

## Goal

Add **Outlines** as a new story element to panel-navigation (alongside Scenes, Locations, etc.). Outlines are collections of AI-generated and user-created unordered list items. The UI reuses the existing ListWidget / ScriptItem pattern; the key difference is the add/edit modal, which displays an **outline creator interface** instead of the standard title/description/notes/tags form. All outline editors expose an AI generate button backed by a new outline-writing route.

---

## Data Model

**Outline** entity (new):
- `id`, `scriptId`, `title`, `sortIndex`, `createdAt`, `updatedAt`
- `items` – `Json` // array of `{ id?, text, source? }`

Minimal schema today: `[{ text: string }]`. Enables:
- Stable reordering without relying on index
- Adding `source: 'ai' | 'user'` later without migration
- Matches how lines are treated elsewhere

UI still treats items as a string list; adapter handles normalization.

---

## Adapter Payload Contract (OutlineEditorAdapter)

Keep UI string-based, store structured:

```js
buildPayload({ title, items }) {
  return {
    title,
    items: items.map(t =>
      typeof t === 'string' ? { text: t } : t
    )
  };
}

getFieldValues(item) {
  return {
    title: item.title,
    items: (item.items || []).map(i => i.text ?? i)
  };
}
```

---

## Key Swing Points

### 1. Panel Integration

| File | Change |
|------|--------|
| `public/index.html` | Add `<button data-target="user-outlines">Outlines</button>` and `<div class="user-outlines hidden"></div>` |
| `public/js/constants.js` | Add `USER_OUTLINES_PANEL: '.user-outlines'` |
| `public/js/app/bootstrap/AuthenticatedAppBootstrap.js` | Add `'user-outlines'` to `targetsMap`, `initOutlinesUI()` |
| `public/js/widgets/ui/SidePanelWidget.js` | Extend default `targetsMap` if used standalone |

### 2. Store & API

| File | Change |
|------|--------|
| `server/prisma/schema.prisma` | Add `Outline` model, `Script.outlines` relation |
| `server/prisma/migrations/` | New migration |
| `server/controllers/script/items/outline.controller.js` | **New** – CRUD + reorder (mirror `scene.controller.js`) |
| `server/routes.js` | Add outline routes + AI idea routes |
| `public/js/services/api/ScriptEntitiesService.js` | Add outline endpoints |
| `public/js/stores/OutlineStore.js` | **New** – thin: CRUD, reorder, generateIdea, generateIdeaDraft. No formatting, no list preview (adapter handles that). |
| `public/js/core/StateManager.js` | Add `OUTLINES` key |

### 3. List Pattern Reuse

| File | Change |
|------|--------|
| `public/js/widgets/list/ScriptItemUIBootstrap.js` | No change – reusable |
| `public/js/widgets/outline/OutlinesUIBootstrap.js` | **New** – mirrors `ScenesUIBootstrap` |
| `public/js/widgets/outline/OutlineBrowserWidget.js` | **New** – extends `ListWidget` |
| `public/js/widgets/outline/OutlineListAdapter.js` | **New** – extends `createTaggedListAdapter` with `OutlineStore`, `supportsAi: true` |

Key adapter choices:
- `getTitle(item)` → `item.title`
- `getMetaText(item)` → see §6 List Tile Meta Preview below
- `emptyItem`: `{ title: '', items: [] }`
- `buildRenamePayload` / `buildOrderPayload` – include `items` in update payloads

### 4. Editor Adapter – Main Swing Point

Standard items use `TaggedEditorAdapterFactory` (title, description, notes, tags). Outlines need an **outline creator interface** – an unordered list editor.

| File | Change |
|------|--------|
| `public/js/widgets/editor/TaggedEditorAdapterFactory.js` | No change – keep for scenes, etc. |
| `public/js/widgets/outline/OutlineEditorAdapter.js` | **New** – custom adapter with tight payload contract (see Adapter Payload Contract above) |
| `public/js/widgets/editor/ModalEditorView.js` | Extend to support `field.type === 'outline'` → render outline creator UI instead of input/textarea |

**Alternative**: Create `OutlineEditorView.js` and `OutlineEditorController.js` that render the outline creator and plug into `ListWidget.openEditor`. `ListWidget` would need a branch: if editor adapter has `isOutlineEditor: true`, use `OutlineEditorView` instead of `ModalEditorView`.

**Recommendation**: Add `field.type === 'outline'` to `ModalEditorView.renderField()` and a small `OutlineCreatorComponent` that handles add/remove/reorder of list items. Keeps one modal flow, minimal duplication.

### 5. OutlineCreatorComponent Contract

Keep it dead simple:

- **Props**: `value: string[]`, `onChange(items: string[])`
- **Internally**: maintain local array; emit new array on add/remove/reorder/edit
- **No** store awareness. **No** API calls. Pure UI component.

| File | Change |
|------|--------|
| `public/js/widgets/outline/OutlineCreatorComponent.js` | **New** – pure UI, props above |
| `public/css/components/outline-creator.css` | **New** – styles for list editor |

### 6. List Tile Meta Preview

In `OutlineListAdapter`:

```js
getMetaText(item) {
  const count = item.items?.length || 0;
  if (!count) return 'No items';
  return item.items
    .slice(0, 3)
    .map(i => `• ${i.text}`)
    .join('  ');
}
```

Avoid raw JSON or counts-only. A small preview makes tiles feel alive.

### 7. Inline Editing Decision

**Decision**: Clicking tile opens modal. **Do not** support inline UL editing in tiles.

- Tiles are for browsing
- Modal is for editing
- Keeps ListWidget complexity stable

### 8. AI Outline Route & Chain

**Locked AI response format**:

```json
{
  "title": "Optional title",
  "items": [
    "Opening image",
    "Inciting incident",
    "Midpoint reversal",
    "Climax"
  ]
}
```

On server, normalize to: `items: items.map(text => ({ text, source: 'ai' }))`

| File | Change |
|------|--------|
| `server/controllers/script/ideas/outline-idea.controller.js` | **New** – dedicated handler, parses response, normalizes items |
| `shared/promptRegistry.js` | Add `outline-idea` prompt (system + user) |
| `server/routes.js` | `buildIdeaRoutes({ basePath: '/script/:scriptId/outlines', idParam: 'outlineId', ideaSlug: 'outline-idea', handler })` |
| `public/js/services/api/ScriptEntitiesService.js` | `generateOutlineIdea`, `generateOutlineIdeaDraft` |
| `public/js/stores/OutlineStore.js` | Wire `generateIdea` / `generateIdeaDraft` to API |

### 9. OutlineStore Responsibilities

Keep OutlineStore thin:

- CRUD
- reorder
- generateIdea
- generateIdeaDraft

No formatting. No list preview logic. That belongs in adapter.

### 10. MediaOwnerType (Optional)

If outlines get media (e.g. cover): add `outline` to `MediaOwnerType` in schema and attachment logic. Defer if not needed for v1.

---

## File Summary

### New Files

- `server/controllers/script/items/outline.controller.js`
- `server/controllers/script/ideas/outline-idea.controller.js`
- `server/prisma/migrations/YYYYMMDD_add_outlines/migration.sql`
- `public/js/stores/OutlineStore.js`
- `public/js/widgets/outline/OutlinesUIBootstrap.js`
- `public/js/widgets/outline/OutlineBrowserWidget.js`
- `public/js/widgets/outline/OutlineListAdapter.js`
- `public/js/widgets/outline/OutlineEditorAdapter.js`
- `public/js/widgets/outline/OutlineCreatorComponent.js`
- `public/css/components/outline-creator.css`
- `shared/prompts/outline-idea` (or entry in promptRegistry)

### Modified Files

- `server/prisma/schema.prisma` – Outline model
- `server/routes.js` – outline CRUD + AI routes
- `public/index.html` – nav button + panel div
- `public/js/constants.js` – USER_OUTLINES_PANEL
- `public/js/app/bootstrap/AuthenticatedAppBootstrap.js` – targetsMap, initOutlinesUI
- `public/js/core/StateManager.js` – OUTLINES key
- `public/js/services/api/ScriptEntitiesService.js` – outline API + AI
- `public/js/widgets/editor/ModalEditorView.js` – support `field.type === 'outline'` (or use alternate editor path)
- `public/js/shared/itemLabels.js` – OUTLINE, OUTLINES, etc.

---

## Implementation Order (Refined)

1. Prisma model + migration
2. CRUD controller + routes
3. OutlineStore + ScriptEntitiesService
4. OutlinesUIBootstrap + OutlineBrowserWidget + adapter
5. ModalEditorView outline field support
6. OutlineCreatorComponent
7. AI outline route + prompt + store wiring
8. Meta preview polish

---

## Dependencies

- Existing: ListWidget, ListView, ListController, ListModel, ScriptItemUIBootstrap, ModalEditorController, ModalEditorView.
- Existing: item-idea factory, buildScriptContextBundle, router, promptRegistry.
- Brainstorm: Reference only (notes as list items) – no shared code, different data model and UX.
