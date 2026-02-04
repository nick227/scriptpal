## Chat Refactor Roadmap

### Goal
Remove duplication, consolidate validation, and let intent handlers own the script flows so `/chat` stays simple while the chains stay authoritative.

### Phase 1 – Simplify `startChat`
1. Replace the current `forceAppend`/`expectFormattedScript` branching with a dispatch table (`SCRIPT_INTENT_HANDLERS`) mapping intents to handlers (diagrammed above). Each handler should just call `router.route` (or a wrapper that enriches the context) with the intent and return its canonical `{ message, script, metadata }` payload.  
2. Keep no direct calls to `generateAppendPage`/`generateFullScript`; the chains already encapsulate the prompt + validation logic, so `startChat` becomes: validate → build context → dispatch handler → `buildAiResponse`.
3. Remove the `verifyScriptOwnership` call from the controller and rely solely on the `requireScriptOwnership` middleware declared in `docs/chat-routes.md:1`. If absolutely necessary, keep a light guard that assumes middleware succeeded.

### Phase 2 – Canonical output + schema alignment
1. Standardize every script-oriented chain to return the canonical `{ message, script, metadata }` shape before `buildContractMetadata`. Drop `formattedScript`, `lines[]`, and `expectsFormattedScript` (see `shared/promptRegistry.js` for prompt metadata).  
2. Let `parseFunctionPayload` be the single structural validator; merge any chain-specific helpers (e.g., `validateResponse`, `validateAiResponse`) into it or keep them only when extra domain reasoning is needed. Append metadata tagging (`generationMode`, `lineCount`, `contractValidation`) via `buildContractMetadata`.  
3. Vet every prompt/chain pair at startup: assert that the prompt registry’s JSON contract matches the chain’s schema to catch drift early (`shared/promptRegistry.js` vs `server/controllers/langchain/chains/script/*`).

### Phase 3 – History + logging harmonization
1. Unify history access by routing every need for history (chains or controller) through `ChatHistoryManager`, so depth, ordering, and filtering live in one module (`docs/chat-routes.md:4` references both managers).  
2. Prevent `chatController.getChatMessages` from reversing results by ensuring the repository queries `orderBy: { createdAt: 'asc' }`.  
3. Add log namespaces (`chat.general`, `chat.script.append`, `chat.script.nextLines`) when events flow through the router/coordinator to ease diagnostics (`ConversationCoordinator` already centralizes logging).

### Phase 4 – Shared utilities and policy cleanup
1. Pull the continuation bias rules (speaker→dialog, dialog→action, etc.) into a single module (`shared/screenplayFlow.js`) and import it wherever currently duplicated (see `ScriptPageAppendChain` and `ScriptNextLinesChain`).  
2. Eliminate grammar repair code paths: trust the LLM output once the schema passes, and therefore avoid silent rewrites.  
3. Reduce every chain’s `MAX_ATTEMPTS` to 1 and rely on `AIClient.generateCompletion` retries for transient errors (`docs/chat-routes.md:9` shows existing AIClient retry).  
4. Introduce a lightweight contract test that asserts each prompt in `PROMPT_REGISTRY` still matches its chain schema during boot (fail fast on mismatch).

### Phase 5 – Optional future improvements
1. Event-based observability pipeline (`IntentResolved`, `ContextBuilt`, `ChainExecuted`, `ResponseValidated`) for replay and metrics.  
2. Split `/chat` logs between general chat and script mutations to keep dashboards focused on the right intent.

### Success criteria
- `/chat` is just validation + dispatch → no runtime branching for every new script intent.  
- Chains return the same canonical shape; `buildAiResponse` doesn’t need to inspect `formattedScript` vs `lines[]`.  
- History and logs live in a single location, reducing race conditions and race-check work.  
- Prompt contracts (docs + code) stay synchronized, preventing silent type mismatches.
