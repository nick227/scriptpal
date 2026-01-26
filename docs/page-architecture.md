Page Architecture

Review

The page system is centered on `PageManager`, which owns the authoritative
page list (`this.pages`) and exposes the single source of truth for page count.
Pages are created through intents (via `PageOperations`) and applied in
`PageManager`, with DOM pages treated as a view backed by the `pages` array.

How we track page count

- The canonical count is `this.pages.length`.
- `PageManager.getPageCount()` returns `this.pages.length`.
- `PageManager._notifyPageCountChange()` emits `this.pages.length`.
- The count changes only when page structure changes, i.e. when pages are
  added/removed in `_applyAddPage()`/`_applyRemovePage()`, or when a page break
  removal deletes a page in `_applyRemovePageBreak()`.
- `_syncPageMetadata()` updates `data-page-index` and ensures `data-page-id`
  exists for each entry in `this.pages`, keeping DOM aligned with the array.

Current issue: empty unremovable pages

We are currently seeing empty pages that cannot be removed. Based on the
current implementation, this is expected when:

- `_enforcePageCapacity()` only adds pages to handle overflow; it never removes
  pages when content is removed or shrinks.
- `removeLine()` only removes a line; it does not collapse empty pages.
- `removePage()` is only called explicitly. There is no automatic cleanup step
  that prunes empty trailing pages or merges pages when line counts decrease.
- `validateState()` only checks DOM vs `this.pages` ordering; it does not
  reconcile or delete empty pages.

This means page count is strictly monotonic under normal editing unless an
explicit remove operation runs, so empty pages can persist.

Architecture summary

1) Authority
- `PageManager` is the owner of page structure and count.
- `PageOperations` generates intents only; it does not mutate DOM or state.
- `PageFactory` creates DOM page elements with metadata and layout styles.
- `PageBreakManager` creates and removes page break elements and delegates
  application to `PageManager`.

2) State model
- Page state is an ordered array: `this.pages`.
- Current page is tracked in `this.currentPage`.
- Line-to-page mapping is tracked by `_lineToPageIndex`.

3) DOM as view
- Pages are DOM nodes that mirror the `pages` array.
- Page metadata (`data-page-id`, `data-page-index`, `data-loaded`) is synced
  from `PageManager`.

4) Flow of page changes
- `PageOperations` emits intents (ADD_PAGE, REMOVE_PAGE, ADD_LINE, etc).
- `PageManager._applyIntents()` orders and applies intents.
- Structural changes trigger `_syncPageMetadata()` and `pageCountChange`.

5) Constraints and rules
- Pagination uses `MAX_LINES_PER_PAGE` as the capacity rule today.
- Rules in `docs/page-manager-rules.md` describe the intended authority model
  and determinism.

Implications

- The system tracks page count consistently via the `pages` array.
- Without a cleanup step, empty pages will persist and remain unremovable
  unless a caller issues `removePage()` or removes a page break.
