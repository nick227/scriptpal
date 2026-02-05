# Script Title & Routing Analysis

## Current logic flow

### Backend slug generation & routing
- Every script created through `POST /api/script` runs `scriptModel.createScript`, which normalizes the supplied title, checks whether the resulting slug is already taken (per user and, if the script is public, globally), and persists the slug in the `scripts` table along with the first version record before returning the full script payload to the caller (`server/models/script.js:40-88`).  
- `generateUniqueSlug` trims the title, lower-cases it, removes punctuation, collapses whitespace into hyphens, and then adds a numeric suffix (`-2`, `-3`, ...) when a conflict is detected (`server/lib/slug.js:1-35`). The Prisma schema enforces `@@unique([userId, slug])` and indexes the slug for lookups (`server/prisma/schema.prisma:112-138`).
- Authenticated slug lookups are wired via `/api/script/slug/:slug` in `server/routes.js:195-223`, which delegates to `scriptController.getScriptBySlug` to fetch the slug for the logged-in user and decorate it with media when requested (`server/controllers/script/script.controller.js:65-84`). Server-side entry points `/mine/:slug` and `/mine` both serve `index.html`, so the browser always boots up the same SPA and decides whether to hydrate a slug (`server/server.js:435-454`).

### Client-side slug consumption & URL handling
- `ScriptStore.ensureUserHasScripts` asks the API for the user's scripts; if it returns empty, the store auto-creates a new `'Untitled Script'`, caches it, and sets it as the current script (`public/js/stores/ScriptStore.js:929-937`, `:681-707`).  
- On every authenticated page load the `ScriptsController` first clears any slug banner, ensures scripts exist, reads `location.pathname` for `/mine/:slug`, and if a slug is present it calls `ScriptStore.loadScriptBySlug`. Failures bubble into `slug_not_found`, which triggers `displayScriptNotFoundBanner` so the user can reset to `/mine` (`public/js/services/script/ScriptsController.js:102-233` and `public/js/stores/ScriptStore.js:254-282`).  
- Every time the current script changes (selection, creation, refresh), `ScriptsController.updateUrlForScript` compares the current slug with `window.location.pathname` and either `replaceState` (when the change came from a slug/startup load) or `pushState`, keeping `/mine/:slug` in sync with `script.slug` (`public/js/services/script/ScriptsController.js:183-199`).
- `ScriptStore.updateScript` is the single source of script metadata writes; it validates the payload, normalizes the content, sends a `PUT /api/script/:id` and writes the returned script (which currently only contains the existing slug) into the cache. The queued patches from the title page only ever touch `title`, not `slug`, so renaming a script leaves `slug` unchanged (`public/js/stores/ScriptStore.js:557-631`, `:676-706`).

## Pain points around Untitled + slug routing

- When a user lands on `/mine/untitled-script-2` (the slug suffix exists because `generateUniqueSlug` avoids collisions with public scripts via `scriptRepository.existsPublicSlug`: `server/repositories/scriptRepository.js:110-129`), the SPA still attempts to load that slug before it can guarantee a script exists. If the slug is stale or the app has just created `untitled-script` without being asked to load `/mine/untitled-script-2`, the fetch returns 404 and a "Script not found" banner appears even though a default script exists (`public/js/stores/ScriptStore.js:254-278`, `public/js/services/script/ScriptsController.js:201-233`).
- Because `scriptModel.updateScript` never touches the slug and `ScriptStore.updateScript` only propagates the server response, the slug that drives `/mine/:slug` is stuck at its creation value. Users rename the script title, the editor still rides `/mine/old-slug`, and the banner from the slug fetch never clears until they manually navigate away. That is why we currently "silently" rewrite the URL: we update `window.history` using the existing slug instead of deriving a new slug from the title, so the path never truly tracks the latest title (`public/js/services/script/ScriptsController.js:183-199`).
- The slug-not-found banner helps but feels like a guardrail rather than a fix. It does not avoid the `XHR /api/script/slug/...` failure, nor does it give users confidence they can continue working on `/mine/some-title` after renaming from the Untitled placeholder.

## Strategy for a reliable, title-driven URL surface

1. **Manage slug lifecycle explicitly.**  
   - Keep the existing `scripts.slug` as the canonical, unique identifier used for routing, but add a small `scriptSlugHistory` (or `scriptSlugAlias`) table that stores every slug ever issued for a script along with a flag for the "active" slug.  
   - When a title change generates a new slug (run the existing `generateUniqueSlug` logic against the new title and the alias table), update the script row, insert a history row for the old slug, and ensure `/api/script/slug/:slug` looks up both the primary slug and any alias so renamed URLs continue to resolve.  
   - Extend the slug-uniqueness predicate (`isSlugTaken`) to treat both the current row and the alias table as occupied, which keeps auto-generated suffixes (`untitled-script-2`, `-3`, ...) deterministic even when the title keeps oscillating between identical names.

2. **Update the slug as soon as the user renames.**  
   - Let `PUT /api/script/:id` optionally derive a new slug whenever `title` changes (or when the payload explicitly asks) and return the refreshed slug in the response.  
   - When `ScriptStore.updateScript` receives a response with a different slug, treat it as part of the "current script change" path and let `ScriptsController.updateUrlForScript` `replaceState` the new `/mine/:new-slug` instantly, so users land on a URL that matches their latest title without fighting duplicate history entries.
   - Consider exposing the current slug in the title page UI (and in the persistence layer) so we can show when slug updates are pending and provide a manual "Copy share link" that uses the canonical slug.

3. **Gracefully handle slug mismatches from stale URLs.**  
   - If `/api/script/slug/:slug` still returns 404 (because the slug is older than any alias we know), fall back to the first script in the user's list and call `updateUrlForScript` with a working slug, rather than leaving the error banner up.  
   - During the initial `ensureUserHasScripts` call we can also detect when the current path contains a slug that none of the newly fetched scripts match, then re-run the slug lookup after creating the default script so we never race the slug creation.
   - Expand the error banner to mention "If you just renamed this script, give us a second and the URL will update" so the user understands the next step instead of seeing a dead-end error.

4. **Respect "multiple Untitled docs" without leaking failures.**  
   - Keep generating unique slugs (suffixes) on the server but expose the chosen slug locally so each Untitled doc has its own `/mine/untitled-script-#`. If the user prefers the cleaner slug eventually, the alias mechanism lets us swap it without breaking the others.  
   - Optionally expose a "Set custom slug" control (or reuse the title field) that re-runs `generateUniqueSlug` the same way the server does; we then immediately update the slug alias table and route so the user can "opt into" the new path as soon as they rename the script.

## Next steps

1. **Schema + persistence:** add `scriptSlugHistory` (or similar) with `@@unique([userId, slug])` and column-level metadata (createdAt, activeFlag). Update the `GET /api/script/slug/:slug` path to search both the canonical slug and the history table.  
2. **Slug generation hook:** allow `scriptModel.updateScript` to re-run `generateUniqueSlug` when `title` changes, persist the new slug (and alias the old one), and return it to the client.  
3. **Client sync:** detect slug changes in `ScriptStore.updateScript` and reuse `ScriptsController.updateUrlForScript` (with `replaceState`) so the path reflects the latest slug immediately after the update request resolves.  
4. **Retry/fallback UX:** augment `ScriptStore.loadScriptBySlug` to attempt a fallback script (or re-run alias lookup) before raising `slug_not_found`, and clarify the banner copy so users understand they can click "View my scripts" when a slug stops resolving.  
5. **Testing:** add regression coverage for duplicate Untitled scripts, slug-based routing reloads, and rename-driven slug updates so we can ship the new behavior without introducing stale 404s.
