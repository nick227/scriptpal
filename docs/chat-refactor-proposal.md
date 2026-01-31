# Chat Controller Refactor Proposal

## Objectives
1. Give the chat path a clear orchestrator that explicitly separates **decision** vs **execution** vs **finalization** so reasoning about the flow (guard ? intent ? chain ? fallback ? history) is obvious.
2. Treat intent as the primary control surface: model it with well-defined types, a classifier + deterministic resolver, and a single resolution service that expresses fallbacks, overrides, and audit-ready reasoning.
3. Keep helper libraries (context builders, chain config, handlers) lean and located in folders that reflect who owns the behavior without mixing too many responsibilities.
4. Tame the �system handler� (+ any future LangChain system events) by moving them into a formalized namespace with a consistent contract.

## Current pain points
- `Chat.js` bundles guard logic, intent classification, context construction, chain execution, fallback detection, and history persistence in a single ~6?K file, making it hard to trace what happens before/after a chain runs.
- Intent heuristics (`intentUtils.js`) are treated as utility functions even though the intent determines whether we mutate a script, reflect, or just chat�there is no single truth for �what kind of action does this prompt request?�
- The existing handler (`chat/handlers/SaveElementHandler.js`) is the only thing under `chat/handlers`, so neither the structural nor semantic purpose of that folder is clear.
- �Context� helpers are split across `chat/scriptContextUtils.js`, `chat/contextUtils.js`, and `contextBuilder.js`, but there is no mandated pipeline for how context is assembled, guarded, or overridden.

## Light yet semantic adjustments
### 1. Make orchestration explicit
- Rename `Chat.js` to `ConversationCoordinator.js` (or similar) and document the phases. Internally split the logic even if it remains in one file: create private functions or clearly separated sections for **Decision (guard + intent resolution)**, **Execution (chain/service run + fallback)**, and **Finalization (history + response envelope)**, so a simple read is enough to know what happens when.
- Optionally expose a `ConversationPhase` enum/constant to mark logs (e.g., `console.log('Phase: decision')`), for future instrumentation.

### 2. Treat intent as a domain
- Introduce `server/controllers/chat/intent/` with:
  - `classifier.js` (wrapping `IntentClassifier` and exposing a `classify(context, prompt)` promise).
  - `heuristics.js` (reused version of `intentUtils.js`, renamed and documented).
  - `resolution.js` (new) that 1) accepts classifier output + heuristics + configuration flags (forceAppend, forceFullScript), 2) returns a typed `IntentResult` (e.g., `Reflection`, `Mutation`, `Conversation`), and 3) defines explicit fallback rules (e.g., �if mutation intent failed validation ? general conversation�).
- All callers should consult the resolver instead of invoking heuristics directly; the orchestrator will ask �what action category does this prompt belong to� and then branch accordingly.
- Define enum-like constants for the intent categories so downstream modules (chains, services) can assert they�re handling the expected type.

Intent categories should be semantic, not chain-named:

Prefer:
Conversation
Reflection
Mutation
SystemCommand

Avoid:
SCRIPT_APPEND
NEXT_FIVE_LINES

### 3. Clarify context construction
- Consolidate the context helpers under `chat/context/` with a documented pipeline:
  1. `scriptContext.js` (previously `scriptContextUtils.js`) builds title/description/metadata.
  2. `overrides.js` (previously `contextUtils.js`) filters protected keys.
  3. `builder.js` (current `contextBuilder.js`) orchestrates script bundle, collections, flags like `expectsFormattedScript`, and the override injection.
- Ensure the orchestrator calls the context builder once per request and passes the resulting object into both chain execution and response validation.

### 4. Formalize handlers
- Move `SaveElementHandler` out of `chat/handlers` into a namespace like `server/controllers/chat/system/` (or even `server/controllers/system/` if it spans wider), rename it to `SaveElementCommand`, and establish a contract (input validation ? command payload ? `aiSystemEventHandler`).
- If future system-level commands are added, they can live alongside `SaveElementCommand` under the same namespace, making the handler layer predictable.
- The chat orchestrator should only depend on this handler when a system intent explicitly triggers it (after intent resolution), and the handler should not import chat-specific helpers.

### 5. Keep chain/response helpers focused
- Leave `chainConfigUtils.js` (renamed to `chain/config.js`) as a shared builder for the `BaseChain` settings; document its consumers (general chat vs next-five-lines). Same for `responseUtils.js` ? `response/validation.js` so the file names explain their domain.
- Explicitly document which metadata flags (e.g., `generationMode`, `formattedScript`) each helper is responsible for so there�s no mystery about who mutates responses.

## Summary of proposed layout
```
server/controllers/chat/
+-- orchestrator/
�   +-- ConversationCoordinator.js   # renamed Chat.js with decision/execution/finalization sections
+-- history/
�   +-- HistoryManager.js            # renamed ChatHistoryManager with well-documented scope checks
+-- intent/
�   +-- classifier.js                # wraps IntentClassifier chain
�   +-- heuristics.js                # regex/intent helpers
�   +-- resolution.js                # the new entrypoint that decides the action category
+-- context/
�   +-- builder.js                   # previously contextBuilder.js
�   +-- overrides.js                 # previously contextUtils.js
�   +-- script.js                    # previously scriptContextUtils.js
+-- chain/
�   +-- config.js                    # previously chainConfigUtils.js
+-- response/
�   +-- validation.js                # previously responseUtils.js
+-- system/
    +-- SaveElementCommand.js        # formerly chat/handlers/SaveElementHandler.js
```

With this structure:
- The orchestrator has explicit phases so each responsibility is visible and testable.
- Intent becomes a first-class domain with resolver logic, types, and clear fallbacks rather than a scattered utility.
- Context, chain config, response validation, and history each own a folder and have a well-defined surface.
- System handlers are no longer �accidental� files; they�re formal commands in their own namespace.

If you�d like, I can start migrating the existing files into this new layout (renaming, moving, and updating imports) and then incrementally split the orchestrator by inserting private functions or even separate modules for each phase. Let me know how far you�d like me to take the implementation.
