Page Manager Rules (clean, strict)
1. Pagination fundamentals

Text must never overflow a page.

Page breaks are explicit decisions, not CSS side effects.

Same input + same styles = identical pagination.

2. Authority & model

One system owns pagination rules.

Pages are views, not the source of truth.

Source model: ordered blocks → lines → pages.

3. Break types

Hard breaks: page/act/scene breaks (always enforced).

Soft breaks: normal text flow.

Hard breaks override all other rules.

4. Keep-together rules

Scene heading cannot end a page.

Character name stays with first dialogue line.

Parentheticals never split.

Optional minimum lines before/after a break.

5. Dialogue continuation

Dialogue may split only at word boundaries.

Continuations are marked (CONT’D) automatically.

Parentheticals are atomic.

6. Editing behavior

Reflow propagates forward only.

No backward repagination on insert.

Cursor position is logical, not DOM-based.

7. Measurement

Pagination uses measured line heights.

Fonts, margins, and DPI are locked before layout.

Line is the smallest breakable unit.

8. Determinism & rebuild

Full rebuild is idempotent.

Pagination can be replayed from history.

No hidden DOM state.

9. Performance

Paginate current and next pages during typing.

Background paginate the rest.

Page count changes only when required.

10. Output fidelity

Screen layout matches print/PDF output exactly.

If you want next:

Convert this into enforceable invariants

Define a minimal block/line/page schema

Map rules directly onto your PageManager responsibilities