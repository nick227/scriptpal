# Script Tags Feature Proposal

## Goal
Add script-level `tags` as part of script metadata so users can:
- add/edit tags on the title page in editor
- persist tags through existing script create/update flows
- display tags in the public script header

## Current Baseline
- Script metadata currently includes `title`, `author`, `description`, `status`, `visibility`, `slug`, `publicId`.
- Title page editor UI is managed in `public/js/widgets/editor/title/TitlePageManager.js`.
- Script metadata persistence is handled through `ScriptStore.queuePatch(...)` -> `ScriptStore.flushPatch(...)` -> `ScriptService.updateScript(...)`.
- Public viewer header rendering is in `public/public-script.html` and `public/js/pages/publicScriptViewerPage.js`.
- Public script responses are shaped by `server/serializers/publicScriptSerializer.js`.

## Proposed Data Model

### Schema Change
Add `tags` to `Script` as JSON array.

`server/prisma/schema.prisma`:
- In `model Script`, add:
  - `tags Json @default("[]")`

### Why JSON on Script
- Matches existing pattern used in `Scene`, `Character`, `Location`, and `Theme` (`tags Json`).
- No join table needed for phase 1.
- Keeps write path simple for metadata patching.

### Tag Rules (Server Canonical Form)
- Type: array of strings.
- Normalize on write:
  - trim whitespace
  - collapse internal whitespace to single space
  - lowercase
  - dedupe
- Limits:
  - max 10 tags per script
  - max 32 chars per tag
  - empty tags removed
- If invalid shape, return `400` with validation message.

## API Contract and Routes

No new route required for phase 1. Extend existing payloads/responses.

### Existing Routes to Extend
- `POST /api/script`
  - accept optional `tags: string[]`
- `PUT /api/script/:id`
  - accept optional `tags: string[]`
- `GET /api/script/:id`
  - include `tags: string[]` in response
- `GET /api/script`
  - include `tags: string[]` in list items
- `GET /api/public/scripts`
  - include `tags: string[]` for each script
- `GET /api/public/scripts/public/:publicId`
  - include `tags: string[]`
- `GET /api/public/scripts/slug/:slug`
  - include `tags: string[]`
- `GET /api/public/scripts/:id`
  - include `tags: string[]`

### Optional Future Route (Not Required for MVP)
- `GET /api/script/tags/suggest?q=...`
  - for autocomplete from user history.

## Backend Implementation Plan

### Repositories/Model/Serializer
1. `server/prisma/schema.prisma`
- add `Script.tags` JSON column.

2. `server/repositories/scriptRepository.js`
- include `tags` in `scriptSelect`.
- include `tags` in list/public queries if select/include is explicit.

3. `server/models/script.js`
- add tag normalization helper (single source of truth).
- in `createScript`, persist normalized tags (default `[]`).
- in `updateScript`, allow metadata update of tags and include tags in `metadataUnchanged` comparison.
- in `clonePublicScriptByPublicId`, copy `sourceScript.tags` into clone.

4. `server/controllers/script/script.controller.js`
- parse/validate `tags` from request body for create/update.
- pass normalized tags to model.

5. `server/serializers/publicScriptSerializer.js`
- include `tags` in serialized output with guaranteed array fallback (`[]`).

### Migration
- Add Prisma migration to append `tags` JSON with default `[]` on `scripts`.
- Backfill not required if DB default applies.

## Frontend Plan

### Editor: Title Page Tag Input
Update `public/js/widgets/editor/title/TitlePageManager.js`.

- Add a new section in title page template:
  - label: `TAGS`
  - input for adding tags (comma/Enter to commit)
  - chip list for current tags with remove action
- Extend local `titlePageData` with `tags: []`.
- On script hydrate/change, load `script.tags`.
- On tag add/remove:
  - update local state
  - queue metadata patch via `scriptStore.queuePatch(scriptId, { tags }, 'title-page-tags')`
  - flush with existing debounce behavior (same as title/author), or immediate flush on chip remove if preferred.

### Script Store/API Client
1. `public/js/stores/ScriptStore.js`
- add `tags` to `PATCHABLE_FIELDS`.
- standardize script fallback with `tags: []`.
- include `tags` in flush payload and update path.

2. `public/js/services/api/ScriptService.js`
- pass `tags` in `createScript`/`updateScript` payload when provided.

### Public Viewer Header: Show Tags
1. `public/public-script.html`
- add tag container in metadata/header area, e.g. `[data-script-tags]`.

2. `public/js/pages/publicScriptViewerPage.js`
- render `script.tags` as pills in header.
- hide container when empty.

3. `public/css/components/public-scripts.css`
- add styles for compact tag pills in header metadata row.

## Validation and UX Behavior

### Editor Input UX
- Accept tags by Enter or comma.
- Prevent duplicates (case-insensitive).
- Show inline cap feedback at 10 tags.
- Allow removal by click on chip `x` and Backspace-from-empty-input behavior.

### Public Header UX
- Show first 5 tags by default for compact layout.
- If more than 5, show `+N` indicator (optional phase 1.5).
- On mobile, allow wrap and keep pills compact.

## Testing Plan

### Backend
- create script with valid tags -> persisted and returned.
- update script tags only (no content) -> new version behavior matches existing metadata update semantics.
- invalid tags payload -> `400`.
- public endpoints include tags.
- clone endpoint copies tags.

### Frontend
- title page renders existing tags from current script.
- add/remove tag updates local UI and persists.
- duplicate tag not added.
- public viewer displays tags when present, hidden when absent.

## Rollout Steps
1. Add schema migration and backend support.
2. Add editor title-page tag UI and patching.
3. Add public header tag rendering/styles.
4. Add/update tests.
5. Verify existing script create/update and public viewer flows remain stable.

## Open Decisions
1. Should tags remain lowercase-only in UI, or store lowercase but render original casing?
2. Do we want tag-based filtering in `/public/scripts` in this same release?
3. Should tags be indexed later via generated column/fulltext for search?
