# Public Author/Tag Routing Analysis and Proposal

## Goal
- Document current client/server routing for public scripts.
- Explain where filtering can be added.
- Propose URL routing for `author` and `tag` filters.
- Break down the work to make author/tag values clickable hyperlinks on public pages.

## Current Routing: Server Side

### Page routes (Express)
- `/public` serves `public-scripts.html` (`server/server.js:446`).
- `/public/:slug` serves legacy public-script routing logic, and may redirect to canonical `publicId` URL (`server/server.js:447`).
- `/public/:publicId([A-Za-z0-9]+)/:slug?` serves `public-script.html` (`server/server.js:468`).
- `/mine` and `/mine/:slug` serve the authenticated SPA entry (`server/server.js:469`, `server/server.js:470`).

### API routes (under `/api`)
- `GET /api/public/scripts` list endpoint (`server/routes.js:74`).
- `GET /api/public/scripts/public/:publicId` single public script (`server/routes.js:79`).
- `GET /api/public/scripts/slug/:slug` legacy single-script lookup (`server/routes.js:90`).
- The list controller currently reads paging and sort only: `page`, `pageSize`, `sortBy`, `order` (`server/controllers/public/public-script.controller.js:17-25`).

### Public list query behavior today
- `scriptRepository.getPublicScripts` only filters `visibility: 'public'`.
- Sortable fields are limited to `createdAt`, `updatedAt`, `title`.
- There is no author or tag filter in repository/model/controller path (`server/repositories/scriptRepository.js`, `server/models/script.js:440-456`).

## Current Routing: Client Side

### Dev server route resolution (Vite)
- `/public` resolves to `public-scripts.html`.
- `/public/<one-segment>` and `/public/<two-segment>` resolve to `public-script.html` (`vite.config.js:15`, `vite.config.js:24`).

### Public list page flow
- `publicScriptsPage.js` initializes `PublicScriptsWidget`.
- `PublicScriptsWidget.loadPublicScripts()` calls `PublicScriptService.getPublicScripts()` with page/sort only (`public/js/widgets/script/PublicScriptsWidget.js:64`).
- `PublicScriptService.getPublicScripts()` serializes only `page`, `pageSize`, `sortBy`, `order` into query params (`public/js/services/api/PublicScriptService.js:24-33`).

### Public script viewer flow
- `publicScriptViewerPage.js` parses URL path segments in `getPublicPathInfo()` (`public/js/pages/publicScriptViewerPage.js:20`).
- It loads script by `publicId`, fallback legacy slug, or query `id`.
- It writes canonical URL via `canonicalizePublicUrl()` to `/public/:publicId/:slug` (`public/js/pages/publicScriptViewerPage.js:48`).

## Current Author/Tag Rendering
- Public list cards render author as plain text span (`public/js/widgets/script/PublicScriptsWidget.js:151-153`).
- List tags render as plain text `Tags: a, b` (`public/js/widgets/script/PublicScriptsWidget.js:160-168`).
- Viewer header renders author as plain text `by ...` (`public/js/pages/publicScriptViewerPage.js:536`).
- Viewer tags render as plain text `Tags: ...` (`public/js/pages/publicScriptViewerPage.js:64`, `public/js/pages/publicScriptViewerPage.js:542`).

## Routing Constraint You Need To Plan Around
- `/public/:publicId/:slug?` already captures 1-2 path segments after `/public`.
- If you add `/public/author/:authorSlug` or `/public/tag/:tagSlug`, those paths are currently interpreted as script-view routes, not list-filter routes.
- Same collision exists in Vite dev route matching (`vite.config.js:24`).

## Proposal: Author + Tag URL Routing

### Recommendation (canonical)
- Keep list routing on `/public`.
- Add filter query params:
  - `/public?author=<authorSlug>`
  - `/public?tag=<tagSlug>`
  - `/public?author=<authorSlug>&tag=<tagSlug>`

Why this is the safest fit:
- No conflict with existing `/public/:publicId/:slug?` viewer route.
- Minimal server page-route changes.
- Works cleanly with current public list page architecture.
- Supports multi-filter combinations naturally.

### Optional pretty aliases (non-canonical)
- Add alias routes that redirect to canonical query format:
  - `/public/filter/author/:authorSlug` -> `/public?author=...`
  - `/public/filter/tag/:tagSlug` -> `/public?tag=...`
- If you do this, update both:
  - Express page routes (`server/server.js`) to serve/redirect `public-scripts.html`.
  - Vite `resolvePublicRoute()` so local dev resolves these paths correctly.

## API Filtering Proposal

### Extend existing list endpoint
- Keep endpoint as `GET /api/public/scripts`.
- Add optional query params:
  - `author` (normalized slug/text)
  - `tag` (normalized lowercase tag)

### Server implementation shape
1. Controller: parse `author`, `tag` from query and pass to model.
2. Model: forward filters to repository.
3. Repository: add `where` conditions on top of `visibility: 'public'`.

Notes:
- Tag data is normalized lowercase in model write path, so exact lowercase tag matching is viable.
- Author is not normalized today; decide whether to do exact match, case-insensitive match, or introduce an `authorSlug` normalization strategy.

## Hyperlinking Proposal (Public Pages)

### List page (`/public`)
- Author text becomes `<a href="/public?author=...">Author Name</a>`.
- Each tag becomes an individual link (chip or inline link):
  - `/public?tag=thriller`
  - `/public?tag=comedy`

### Viewer page (`/public/:publicId/:slug`)
- Header author becomes link to `/public?author=...`.
- Header tags become clickable links to `/public?tag=...`.

## Work Breakdown

1. API filter plumbing
- Update `server/controllers/public/public-script.controller.js` to accept `author`, `tag`.
- Update `server/models/script.js` `getPublicScripts(options)` flow to pass filters.
- Update `server/repositories/scriptRepository.js` `getPublicScripts` to apply author/tag filtering.

2. Client service and list-state plumbing
- Update `public/js/services/api/PublicScriptService.js` to send `author`, `tag`.
- Update `public/js/widgets/script/PublicScriptsWidget.js` to:
  - read filter values from `window.location.search`,
  - request filtered data,
  - reset paging when filters change.

3. URL-state handling on public list
- On filter click, navigate to canonical query URL on `/public`.
- On initial load, parse query params and hydrate widget state.

4. Hyperlink rendering
- List card: author and tags as anchors.
- Viewer header: author and tags as anchors.

5. Optional alias routes
- Add `/public/filter/...` alias handling in `server/server.js`.
- Add matching dev-route support in `vite.config.js`.

6. Validation/testing
- Confirm list filtering by author only, tag only, and both.
- Confirm public script viewer canonical route still works unchanged.
- Confirm legacy `/public/:slug` and `/public-script.html?id=...` behavior still resolves.

## Suggested Delivery Order
1. API filtering first.
2. List page query-param state and filtering.
3. Author/tag hyperlinks in list and viewer.
4. Optional pretty alias routes last (only if needed).
