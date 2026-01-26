Page Manager cleanup proposal

Scope
- Keep PageManager as the single authority for pages and pagination state.
- Preserve current behavior; propose only safe, staged changes.
- Align with rules in docs/page-manager-rules.md.

Safe fixes completed
- Page IDs use a monotonic counter to avoid fast-operation collisions.
- PageFactory generates fallback IDs to avoid undefined dataset values.
- PageManager guards public methods after destroy and warns on misuse.
- validateState no longer rehydrates pages from the DOM.
- setCurrentPage now warns when a page is unmanaged.

Current weaknesses and drift
- Two data models (DOM vs this.pages) existed; this is now blocked but other services still mutate internals.
- PageOperations and PageBreakManager depend on PageManager internals (tight coupling).
- PageManager still mixes structure, DOM, and control flow; hard to replay or debug.
- Async APIs without real async work make call sites ambiguous about intent.
- Page metadata is updated opportunistically instead of on structural changes only.

Text clipping risks
- MAX_LINES_PER_PAGE is a fixed count and does not measure actual line height.
- CONTENT_HEIGHT is fixed in JS while line height can vary with fonts or DPI.
- Page fullness is detected by line count only, not actual rendered height.
- Content container height and padding are injected inline, which can drift from CSS.

Proposed cleanup (staged)
1) Authority and API boundaries
   - Make PageOperations and PageBreakManager pure services returning intents.
   - Apply intents in PageManager only.
2) Deterministic pagination model
   - Introduce a minimal block/line/page model.
   - Use measured line heights for page capacity.
3) DOM as a view only
   - Move layout styles to CSS classes.
   - Remove DOM queries that can reorder or recreate pages.
4) Lifecycle and state
   - Remove async from non-async APIs or add real async work.
   - Sync page metadata only on structural mutations.

Open decisions
- ID generation: keep monotonic per manager or move to a global generator.
- ARIA role: verify whether per-page role=document is correct for the editor tree.

Next steps
- If approved, I can start with step 1 (intent-based operations) and align tests.
