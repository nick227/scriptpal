# Consolidation Ideas

## Context + AI
- Collapse all prompt context building through `contextBuilder` (done for most flows).
- Centralize `scriptCollections` fetch policy in one place and reuse everywhere.
- Consolidate AI idea chains for items into a single factory (done) and align prompts.
- Standardize AI response validation metadata across all chains.

## Controllers + Routes
- Create shared helper for scriptId validation + ownership checks in controllers.
- Extract common list endpoints into a single controller factory (done) and expand for AI routes.
- Unify AI idea route wiring into a single route builder to reduce duplication.

## Stores + API
- Generalize item stores using `ScriptItemStore` (done) and keep per-domain overrides minimal.
- Merge API list/create/update/delete/reorder patterns into a shared API helper.
- Centralize store “load by scriptId” behavior and cache handling.

## List UI + Editor UI
- Convert remaining scene-specific CSS class naming into generic class mapping.
- Share the modal editor layout across all list types (already generic), remove any scene-named vestiges.
- Create a small `ListAdapter` type contract doc inside code to enforce consistency.

## DB + Models
- Add a shared Prisma model pattern for tagged items (characters/outlines/themes/scenes) and reuse migrations.
- Create a generic data access layer for ordered script items.

## Utilities
- Consolidate numeric parsing (done via `idUtils`).
- Extract “ordered list query” helper for Prisma ordering and reuse.
- Centralize item label strings in a single constants map.
