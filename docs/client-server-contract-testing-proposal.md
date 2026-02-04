# Client-Server Contract Testing Proposal

## Executive summary
- We currently rely on controller/unit tests and scattered docs to sanity-check the API surface, but there is no automated gate that exercises a real request/response flow or keeps the schema tied to the shared prompt metadata used by the front-end.
- The goal of this proposal is to define a lightweight contract harness that covers the most critical routes (`/script`, `/chat`, `/media`, brainstorm/idea endpoints) and to plan the automation/metrics needed to keep the API payload expectations in sync with the UI.

## 1. Current coverage that touches payload validation
- `server/__tests__/controllers/scriptController.test.js:1` exercises the script controller directly, ensuring the controller rejects missing titles (`createScript`) and returns the expected `201` payload shape when the model returns a bootstrap script, but the test never runs through the Express middleware stack or the router that clients call.
- `server/__tests__/controllers/userController.test.js:1`, `server/__tests__/controllers/mediaControllers.test.js:1`, and `server/__tests__/controllers/chat.test.js:1` follow the same pattern: controllers are invoked with mocked requests/responses so we test business logic/validation in isolation but not the actual API contract across middleware, authentication, and serializers.
- `server/__tests__/services/AIClient.test.js:1` validates the AI service response handling and metrics, confirming that downstream code will only see the standard `choices`/`usage` payload, but it does not assert that the controller or chat layer shapes that payload into the `intent`/`response`/`metadata` object that the client receives.
- Documentation such as `docs/chat-routes.md:73` and `docs/PROMPT_REGISTRY_ANALYSIS.md:7` describe the contract encoded in `shared/promptRegistry.js:1`, and `docs/frontend-test-roadmap.md:1` records that most UI suites are currently blocked by missing browser mocks, so the front-end cannot be the source of contract truth today.

## 2. Gaps we need to close for reliable contracts
- **Router/middleware coverage:** none of the automated tests actually register `routes.js:1` with Express, so there is no guarantee that `validateSession`, `requireScriptOwnership`, or serialization logic stays aligned with what clients see.
- **Shared metadata validation:** the registry in `shared/promptRegistry.js:1` is the single source of truth for intent labels, prompt IDs, and expected JSON fields, but there are no tests that import that file and confirm the controller output matches it (promise vs. actual response).
- **End-to-end payload shapes:** the client-side fetch code consumes `intent`, `response`, `metadata`, script lists, media lists, etc., but there are no integration tests emulating a fetch to `/chat`, `/script`, or `/media` to exercise serialization, error envelopes, or pagination fields.
- **Front-end contract enforcement:** `docs/frontend-test-roadmap.md:1` shows the front-end test suites are not reliable enough to assert payload expectations, and no lightweight contract test exists to run against a mocked API.

## 3. Contract testing strategy
### 3.1. Define the contract schemas
- Start from `shared/promptRegistry.js:1` and `routeHelpers.js:1` to enumerate `intent`, `response`, and `metadata` expectations for each chat/brainstorm route.
- For CRUD endpoints (`/script`, `/user`, `/media`, `/brainstorm`), capture the required request body, query parameters, and the normalized response object (IDs, status, error envelope). Store these schemas in a new `tests/contracts/schemas` module (e.g., using `zod` or `@sinclair/typebox`) so they can be re-used both in tests and future request validators.

### 3.2. Build integration/contract tests
- Create a new Jest suite under `server/__tests__/contracts/` (or `tests/contracts/`) that spins up the Express app from `server/server.js` (or a lightweight version using `routes.js`) with mocked auth dependencies (e.g., `validateSession` stub that injects `userId`) so we can call the real middleware.
- Use `supertest` to issue canonical requests (e.g., `POST /script`, `GET /script`, `POST /chat`, `POST /media/generate`) to validate:
  - HTTP status (200/201/400) matches expectation.
  - Response body matches the expected schema (IDs, arrays, `intent`, `metadata`, pagination fields, error envelope). Integrate the schema checks from section 3.1.
  - Authentication errors or validation failures still return the documented error payload (e.g., `{ error: 'Title is required' }`).
- Run the same suite against both happy-path responses and API errors/fallbacks to ensure the contract does not drift.

### 3.3. Validate payload expectations for shared data
- Add tests that import `shared/promptRegistry.js:1` (and the `PROMPT_CATEGORIES` values used by `shared/routeHelpers.js:1`) and then validate that the actual payload returned by `chatController` or `brainstormPromptController` contains the fields promised by each prompt definition (e.g., `response`, optional `formattedScript`, etc.).
- Where the clients expect boolean flags (like `expectsFormattedScript` or `scriptMutation`), ensure the controller sets/clears those flags in the JSON response by asserting the combined object matches the prompt metadata.

### 3.4. Strengthen request validation tests
- Expand the existing controller unit tests to include schema assertions on the incoming payload (e.g., ensure `/script` `createScript` rejects if `content` is missing and returns the error envelope defined in the schemas). This ensures the contract is enforced at the boundary, even before the integration tests run.

### 3.5. Front-end contract harness
- Introduce a lightweight contract test in `public/js/__tests__/contract` that mocks `fetch` and calls `window.api` helpers to ensure they expect the same schema the backend returns (this can be a smaller set than the full front-end suite, so it remains stable while the rest of the UI is being refactored).
- Use the schema definitions from section 3.1 to assert the front-end's `api.chat.start`/`api.script.create` helpers check for the same fields and error shapes as the backend.

## 4. Rollout plan
1. **Phase 0 – Inventory & Schema codification (1 week):** Lock down the canonical fields per route using `shared/promptRegistry.js:1`, `routes.js:1`, and the existing controller tests. Create the schema files and add `npm run lint` validation for them.
2. **Phase 1 – Script + User contracts (2 weeks):** Implement the integration tests for `/script` and `/user` routes, including success, validation failure, and authentication failure paths. Use these to prove out the schema harness and automation tooling.
3. **Phase 2 – Chat/Brainstorm contracts (2 weeks):** Expand the harness to hit `/chat`, `/chat/messages`, and brainstorm prompt endpoints, verifying the `intent`/`metadata` payload matches `shared/promptRegistry.js:1` and that `/system-prompts` returns the documented `response` object.
4. **Phase 3 – Media/attachments (1 week):** Add contract tests for `/media` routes (upload, library, generate) once the AI/media services can be mocked reliably.
5. **Phase 4 – Front-end guard (ongoing):** Keep the small contract suite in `public/js/__tests__/contract` running so the unstable UI tests don't regress the API expectations while the big suite is being fixed (see `docs/frontend-test-roadmap.md:1`).

## 5. Automation & success metrics
- Add `npm run test:contracts` (server) and `npm run test:frontend-contracts` (public) that execute the new suites with coverage reporting so we can track regression.
- Require contract tests in the CI workflow before release builds and track coverage for the schema files to ensure they never drop below 80%.
- If a contract test fails, the error message should include the route path and the schema name so the owning team can quickly identify which payload drifted.
- Document the new harness in `docs/TESTING.md:1` under a “Contract testing” section so future contributors know where to look.

## 6. Risks & open questions
- The Express app depends heavily on runtime config (AI client, redis, prisma). We may need to provide lightweight mocks/stubs in the contract suite so the server initializes deterministically.
- Some routes (e.g., media upload) expect file uploads; consider using `supertest`’s `.attach()` helpers and storing temporary files in `/tmp` during the test run.
- We should decide whether schema validation lives in the controllers or just in the tests; if we expose a runtime validator (e.g., zod) it can be reused by both layers to prevent drift.
- Last, we need to choose how to version the schema artifacts so contract tests can signal a breaking change (e.g., bump schema version in `shared/promptRegistry` metadata and fail the suite if the version is outdated).

## Appendix
- Reference: `routes.js:1` lists all public/protected paths.
- Reference: `shared/promptRegistry.js:1` documents the prompt-driven contract metadata.
- Reference: `docs/chat-routes.md:73` and `docs/PROMPT_REGISTRY_ANALYSIS.md:7` for the narrative on how the registry is consumed today.
