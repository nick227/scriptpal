# LangChain Scripts Analysis
Provides a single-source reference for the active LangChain assets, the script controls that still call them, and the legacy drift that needs attention.

## Module snapshot
- `server/controllers/langchain/constants.js` - configuration, intent metadata, validation rules, and shared formatting clues for every chain in the system.
- `server/controllers/langchain/router/index.js` - the lightweight router that resolves the requested chain via `chainRegistry` and falls back to the general conversation handler when no match exists.
- `server/controllers/langchain/chains/ChainFactory.js` + `registry.js` - registers the live intents (`SCRIPT_CONVERSATION`, `GENERAL_CONVERSATION`, `NEXT_FIVE_LINES`) with the `BaseChain` derivatives that are currently instantiated at startup.
- `server/controllers/langchain/chains/base` - `BaseChain` and `QuestionGenerator` provide the templating, metadata enrichment, prompt packing, and follow-up question generation that every active chain inherits.
- `server/controllers/langchain/chains/edit` - houses the production `AppendScriptChain`, `AppendPageChain`, and `FullScriptChain`, all of which enforce XML-tagged scripts and are consumed through the script services.
- `server/controllers/langchain/prompts` - prompt manager plus reusable templates and the `createResponsePrompts` helper that came from the inspiration, analysis, and question-focused chains.
- `server/controllers/langchain/classifier/index.js` - tiny shim used by `Chat` to run the intent classifier inside `chains/system/IntentClassifier.js`.
- `server/controllers/langchain/handlers/AISystemEventHandler.js` - operational helper that processes DB edits/save commands issued by AI responses.
- `shared/promptRegistry.js` - the new single catalog for system prompts, contracts, and the ancillary service routes so the UI toolbar, API controllers, and chains all reference the same metadata, versioning notes, and response expectations.

## Active script flows
1. **Chat requests** (`server/controllers/chat/Chat.js`): a `Chat` instance builds context (script content, history, metadata), runs `IntentClassifier`, resolves or defaults to `INTENT_TYPES.SCRIPT_CONVERSATION`/`GENERAL_CONVERSATION`, and hands everything to `router.route`.
2. **LangChain routing** (`server/controllers/langchain/router/index.js`) picks the registered chain from `chainRegistry` and executes `run`; when a chain is not known, the general conversation chain handles the prompt.
3. **Script services** (`server/controllers/script-services/AppendPageService.js`, `FullScriptService.js`, `ScriptVersionService.js`) still call `AppendPageChain` and `FullScriptChain` directly to support append/full-script generation workflows triggered from `chatController.startChat`.
4. **Script controller shortcut** (`server/controllers/scriptController.js`) keeps validation and visibility logic separate from LangChain while still relying on the append chains for AI output when `/scripts/:id/append` is hit.
5. **Next Five Lines route** (`server/controllers/nextLinesController.js`) reads the `next-five-lines` registry entry, runs the `NEXT_FIVE_LINES` chain, and returns both the formatted snippet (metadata) and the chat rationale (response field) so downstream clients can render whichever piece they need.
   - `formattedScript` is normalized on the server with canonical line-based tags before it hits metadata, matching the formatter the front end uses for rendering new script content.

## Divergence and drift
- The `server/controllers/langchain/chains/_archived` directory, including `ChainRegistry.js`, `classifyIntent.js`, `generateResponse.js`, `intentSplitter.js`, and legacy creative chains (`WriteScript`, `beatLister`, etc.), is disconnected from the current imports and is not part of the router path. Nothing in `server/controllers/langchain` or `server/controllers` references `_archived` in the active flows, yet those modules show a richer `ChainRegistry` with pre/post hooks, multi-intent handling, and a default `EVERYTHING_ELSE` chain that are no longer aligned with the trimmed-down `chainRegistry`.
- `docs/LANGCHAIN_*` and earlier architecture documents call out multi-intent chains, question flows, and LangChain-heavy components like `classifyIntent.js`, but the runtime now only wires the simplified router + append/full script chains and the `<Chat>` wrapper. The documentation still explains `classifyIntent` as the linchpin even though production now routes through the slimmed-down `IntentClassifier` and chain registry that only registers three intents.
- There are duplicate handling paths for script editing/saving: `AISystemEventHandler` versus the LangChain `ScriptEditHelper` (called from `ScriptVersionService`) highlight overlapping responsibilities; cleaning up this overlap will reduce confusion when auditing AI responses or introducing new intents.

## Notes & next steps
1. Keep the `_archived` folder for reference, but remove unused imports and rename it to make the "legacy" status explicit in future refactors.
2. Align documentation (e.g., `docs/scriptpal-langchain-chains.md`, `docs/LANGCHAIN_CRITICAL_REVIEW.md`) with the trimmed runtime so future contributors understand that only script/general conversation chains (plus the new Next Five Lines flow) are wired in production.
3. Consider expanding `chainRegistry` to include more of the documented intents once the UI/UX requires them, or refactor the router to map `INTENT_TYPES` directly to helper services again if LangChain chains become peripheral.

Phase 1 (Registry + Contracts): Build a central prompt registry/schema (metadata, output contract, route mapping) that both backend router and UI routes consume; use it to document the scaffold/ideas flows as well as the new "next five lines" action, ensuring explicit output shapes instead of model guesswork.

Phase 2 (Route-first Execution): Wire dedicated routes for every system prompt, starting with "next five lines" - each route should enforce the contract, attach scripts when required, and return both formatted script and chat explanations so downstream consumers pick what they need without extra inference logic.

Phase 3 (Quality & DX): Add lightweight validation (format linting, schema checks) plus telemetry for deviation detection, and ship developer tooling (prompt playground, example library, README updates) so prompt authors can iterate with visibility and confidence.

Phase 4 (Iterate & Measure): Formalize consistency policies (line counts, script inclusion rules), log results against them, and review metric trends monthly so new system prompts plug into the same expectations while we prune legacy drift.
