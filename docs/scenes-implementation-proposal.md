# Scenes Implementation Proposal

## Goal
Introduce a "Scenes" feature with schema support, new routes, and a grid-based scene browser widget that allows users to add, remove, and sort scenes as square tiles. The widget supports two sizes: small (inside `.side-panel-panel`) and large (full-screen modal).

## Scope
- Data model for scenes (title, description, notes, tags, sort order).
- Backend routes for CRUD + ordering.
- Front-end scene browser widget with grid-based sorting UX.
- Integration with existing script context and permissions.

## Design Constraints
- Scenes are planning metadata, not script text.
- Scenes do not own, map to, or mutate editor lines.
- Deleting or reordering scenes never alters script content.
- Script edits do not auto-update scenes.

## Data Model
Proposed entity: `Scene`
- `id`
- `scriptId` (foreign key)
- `title` (string)
- `description` (text)
- `notes` (text)
- `tags` (string array or normalized join table)
- `sortIndex` (integer)
- `createdAt`
- `updatedAt`

Notes:
- `sortIndex` drives grid ordering.
- Tags can start as a delimited string if the current schema avoids arrays.

## API Routes
Base: `/api/scripts/:scriptId/scenes`
- `GET /` → list scenes by `sortIndex`
- `POST /` → create scene
- `PUT /:sceneId` → update scene fields
- `DELETE /:sceneId` → remove scene
- `PUT /reorder` → batch update ordering (array of `{ sceneId, sortIndex }`)
- All routes enforce script ownership middleware.
- `PUT /reorder` validates all `sceneId`s belong to the same `scriptId`.
- Optional later: `POST /ai/expand` for Scene → Script (not in v1).

## UI: Scene Browser Widget
Placement and sizes:
- Small: embedded in `.side-panel-panel`
- Large: full-screen modal overlay with the same grid layout

Core features:
- Grid-based layout with square tiles
- Add scene (inline or modal action)
- Remove scene (per-tile action)
- Drag/drop reorder updates `sortIndex`
- Editable fields: title, description, notes, tags

Interaction notes:
- Reordering updates local state first, then persists via `PUT /reorder`.
- Tile selection can open detail/edit panel if needed later.
- Scene tiles are non-authoritative (planning only).
- Any “Write / Expand” action makes it clear it appends to script, not replace.

## Integration Points
- Script context/store: scenes are tied to a script and loaded with other script data.
- Permissions: reuse script ownership checks for all scene mutations.
- Existing UI patterns: use the same widget structure, state manager, and renderer patterns.

## AI Integration (Optional)
- Scene → Script: AI may generate formatted script from a selected scene (append-only).
- Script → Scene: AI may suggest or generate scenes from existing script (create-only).
- No automatic sync; all AI actions are user-triggered.

## Migration Plan
1. Add schema/migration for `Scene`.
2. Add backend controller + routes with ownership middleware.
3. Add store + controller wiring on front-end.
4. Add `SceneBrowserWidget` and wire to Script UI.
5. Manual QA for add/remove/reorder in both sizes.
6. Existing scripts start with zero scenes; opt-in only, no backfill.

## Tests
- API: CRUD and reorder (happy path).
- UI: add/remove/reorder, modal toggle, persistence.

## Milestones
1. Schema + routes complete.
2. Scene store/controller complete.
3. Scene browser widget (small) complete.
4. Full-screen modal variant complete.
