# Script Lines Not Rendering – Bug Research

## Verification result (2026-02-06)

**API is returning the expected data.** The backend returns whatever is the **latest** version in the DB for that script.

- For script id 2, the **latest version in the DB is 53**, and version 53 has **contentLength: 91**, **lineCount: 1** (one empty header line). The API correctly returns that.
- **Version 52** has the full content: **2727 chars, 31 lines** (the "welcome home" / "ga" / etc. content).
- So the problem is **not** the API or caching: a **save** created version 53 with minimal content (91 chars), overwriting the good state. The API then correctly serves that latest version.

**Root cause (confirmed):** Something on the frontend (or a triggered save) is **persisting minimal content** (one empty header line), creating new versions that overwrite the real script. The fix is to find why that save is triggered with wrong content (e.g. editor loading with empty/minimal content then auto-save, or a race where we save before full content is loaded).

---

## Summary

Script content exists in the database (MySQL script version content is full JSON with lines) but the frontend shows no lines in both the **editor (/mine)** and **public script** views. The console shows `[ScriptStore] flushPatch` with `contentLength: 91` and `hasContent: true`, while the UI is empty.

## Observed Symptoms

| Observation | Detail |
|-------------|--------|
| DB | Script 2 **latest version (53)** in DB has 91 chars / 1 line. **Version 52** has full content (2727 chars, 31 lines). |
| API | Returns latest version (53) with 91-char content — correct; the bad data is in the DB. |
| Console | `flushPatch` logs `scriptId: 2`, `hasContent: true`, `contentLength: 91`. |
| UI | Editor and public viewer both show no lines (they render latest version). |
| Timeline | Worked yesterday; broke after a recent refactor. A save created v53 with minimal content. |

## Single Point of Failure (Affects Both Views)

Both the editor and the public viewer render from **script content**:

- **Editor**: `EditorWidget.loadScript({ script })` uses `script.content` and passes it to `contentComponent.updateContent(contentValue, ...)`. The value comes from the same script object that is the current script in state (from ScriptStore / API).
- **Public viewer**: `renderStaticScriptLines(viewerLines, script.content || '')` and builds the DOM from `ScriptDocument.fromStorage(content)`.

So if **script.content** is missing, empty, or wrong (e.g. only 91 characters) at the time of rendering, both views will show no lines. The common failure point is: **the script object used for rendering does not contain the full content string**.

## Data Flow (Where Content Comes From)

### Backend

- **GET /script/:id** (owned): `scriptController.getScript` → `scriptModel.getScript(id)` → `scriptRepository.getById(id)` (metadata only) + `scriptVersionRepository.getLatestByScriptId(id)` (full row, includes **content**) → `toScriptWithVersion(script, version)` → `content: version ? version.content : ''`. So the API **does** return `content` for a single script.
- **GET /script/slug/:slug** (owned): Same idea via `scriptModel.getScriptBySlug(userId, slug)` → get by slug, then latest version with content. Content is included.
- **GET /public/scripts/public/:publicId** and **GET /public/scripts/slug/:slug**: Repository uses `versions: { take: 1, select: { versionNumber, content, createdAt } }`. Content is included.
- **GET /script** (list): `getAllScriptsByUser` uses Prisma with `versions: { select: { versionNumber, createdAt } }` — **no `content`**. So list scripts have **empty content** (`toScriptWithVersion` → `content: ''`).

So: **single-script and public endpoints return content; list endpoint does not.**

### Frontend

1. **/mine (editor)**  
   - User has slug in URL → `ScriptsController.handleUserChange` → `scriptStore.loadScriptBySlug(slug)` → API returns full script → `applyLoadedScript` → `setCurrentScript(standardized)` → later `handleCurrentScriptChange(script)` → `editorWidget.loadScript({ script })` → `contentValue = script.content` → `updateContent(contentValue)`.  
   - No slug → `selectInitialScript` → `selectScript(preferredId)` = `loadScript(id)` → same chain: API returns full script, then editor gets `script.content`.

2. **Public viewer**  
   - Fetches script via `getPublicScriptByPublicId` / `getPublicScriptBySlug` / `getPublicScript(id)` → then `renderStaticScriptLines(viewerLines, script.content || '')`.

So under normal operation, the script used for rendering is the one just loaded from the API (with content). The only way both views show no lines is if that script object has no or truncated content when it reaches the render step.

## Why `contentLength: 91` in flushPatch?

`flushPatch` logs `entry.patch?.content?.length`. The patch is built from **what the editor is saving** (e.g. `EditorSaveService` → `this.content.getContent()` → normalized and passed to `queuePatch(..., { content: normalized })`). So **91** means the **in-memory document** (and thus the current script content the app is working with) is only 91 characters. So the editor was never given the full script body — either:

- The script loaded from the API had only 91 characters of content, or  
- The script object passed into `loadScript` / used for rendering was not the full script (e.g. a list item or a truncated/restored state), or  
- Something overwrote or replaced the full content with a 91-character value later.

So the bug is upstream: **the script content that reaches the editor (and/or the store’s current script) is only 91 characters.**

## Hypotheses (Possible Causes)

1. **Using list script instead of full script**  
   If at some point `currentScript` is set from the **list** (scripts from `getAllScriptsByUser`, which have no content), and the editor or public view reads that, they would get empty or minimal content. In the current code, `setCurrentScript` is only called from `applyLoadedScript`, `applyPatchLocally`, title/author updates (spread from `getCurrentScript()`), create/update response, delete, or clear. We do **not** set current script from a list item directly. So this would require a refactor that introduced a path where list data is used as current script (e.g. restoring from a snapshot that only had list fields).

2. **Persistence restoring a script with no/truncated content**  
   `PersistenceManager.restoreScriptState(scriptState)` only sets `CURRENT_SCRIPT_ID`, cursor, scroll, and `requestedScriptId`; it does **not** set `CURRENT_SCRIPT`. So we don’t restore a full script object from storage. If, however, a refactor started persisting/restoring `currentScriptState` as a full script object (e.g. from `scriptpal_complete_state` or `currentScriptState`) and that stored object had no content or only 91 chars, then restoring it and setting it as current script would explain empty rendering and 91-char patches.

3. **Browser cache for GET /script/:id or GET /script/slug/:slug**  
   If the browser (or a proxy) returns a **304 Not Modified** and the client reuses a **cached response body** from an earlier request that had no content (e.g. from a bug or from a list-style response), then `script.content` would be empty or wrong. The frontend uses `fetch(..., { credentials: 'include' })` with no `cache: 'no-store'`, so caching is possible. The 304/204 you mentioned are for **messages?scriptId=2**; we need to confirm whether the **script** request (by id or slug) is also 304 and what body is used.

4. **API response shape or middleware change**  
   If a refactor changed the response (e.g. moved content to a nested property, or a middleware strips/truncates body), the client would still expect `script.content`. `attachMediaToOwner` only spreads `owner` and adds `media`, so it does not remove `content`.

5. **Race or ordering**  
   Less likely but possible: something sets `currentScript` to a script with no content (e.g. from list or from a stale event) **after** the full script is loaded, and the editor then loads that script. Would require a specific ordering of events or a new code path from the refactor.

## How to Confirm Where It Fails

1. **Confirm API returns full content**  
   - In Network tab, find the request that loads the script (e.g. `GET /api/script/2` or `GET /api/script/slug/your-slug`).  
   - Check status: 200 vs 304.  
   - If 200: inspect response body and confirm `content` is the full JSON string (length >> 91).  
   - If 304: the body may come from cache; try “Disable cache” and reload, then check again.  
   - Optional: from a logged-in session, call the same URL (e.g. `GET /api/script/2`) with curl/Postman and confirm the JSON has a long `content` string.

2. **Confirm what the frontend receives**  
   There is already a log: `[ScriptStore] loadScript raw api response`, `[ScriptStore] loadScriptBySlug raw api response`.  
   - When you open the script, check that log: does `script.content` exist and is its length the full one (e.g. thousands of characters) or ~91?  
   - If full: the bug is between `applyLoadedScript` / `setCurrentScript` and the editor (e.g. wrong script reference, or content overwritten before `loadScript`).  
   - If 91 or empty: the bug is either the API (or caching) or something replacing the script before this log (e.g. persistence or list data).

3. **Public view**  
   Public page fetches the script in one go and then calls `renderStaticScriptLines(viewerLines, script.content || '')`. If the public view is also empty, either:  
   - The public API response has no or short `script.content`, or  
   - The same script is being used as in the editor (e.g. shared state) and is already truncated.  

   Checking the Network request for the public script (by publicId/slug/id) and the response body will tell you if the backend is sending full content there.

## Suggested Next Steps (No Code Changes Yet)

1. Reproduce and capture in Network tab:  
   - The exact request URL and method for loading the script (by id or slug) on /mine.  
   - The same for the public script view if you use it for the same script.  
2. Note response status (200 vs 304) and response body length and a small snippet of `content` for those requests.  
3. Check the existing `[ScriptStore] loadScript raw api response` (or loadScriptBySlug) log and note `script.content` length.  
4. If possible, hit the same script endpoint (with auth) from curl/Postman and confirm the returned `content` length matches the DB.  

That will tell us whether the failure is: (A) API/cache not returning full content, (B) frontend receiving full content but not passing it to the editor/viewer, or (C) full content being overwritten or replaced somewhere after load.

## Files Touched in This Analysis

- **Server**: `server/models/script.js`, `server/repositories/scriptRepository.js`, `server/repositories/scriptVersionRepository.js`, `server/controllers/script/script.controller.js`, `server/services/media/MediaIncludeService.js`  
- **Frontend**: `public/js/stores/ScriptStore.js`, `public/js/widgets/editor/EditorWidget.js`, `public/js/services/script/ScriptsController.js`, `public/js/services/persistence/PersistenceManager.js`, `public/js/pages/publicScriptViewerPage.js`, `public/js/widgets/editor/model/ScriptDocument.js`, `public/js/services/api/HttpClient.js`

Once we know from the checks above whether the API and the raw loadScript response have full content or not, we can narrow the fix to either backend/caching or to a specific frontend path (load vs persistence vs event ordering).
