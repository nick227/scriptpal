# Chat Routes Reference

## 1. Express wiring
- `POST /chat` (`server/routes.js:92`)
  - Handler: `chatController.startChat` (`server/controllers/chatController.js:220`)
  - Middleware: `[validateSession]`
  - Scope: authenticated user prompts routed through `Chat.processMessage` when no script-only intent fires.
- `GET /chat/messages` (`server/routes.js:98`)
  - Handler: `chatController.getChatMessages` (`server/controllers/chatController.js:76`)
  - Middleware: `[validateSession, requireScriptOwnership()]`
  - Purpose: stream the most recent chat rows for a script, reversing the repository cursor so the UI sees oldest-first entries.
- `POST /chat/messages` (`server/routes.js:104`)
  - Handler: `chatController.addChatMessage` (`server/controllers/chatController.js:151`)
  - Middleware: `[validateSession, requireScriptOwnership()]`
  - Purpose: insert a single user/assistant message with the correct role into `chat_messages`.
- `DELETE /chat/messages/:scriptId` (`server/routes.js:110`)
  - Handler: `chatController.clearChatMessages` (`server/controllers/chatController.js:194`)
  - Middleware: `[validateSession, requireScriptOwnership()]`
  - Purpose: delete all stored rows for the current `(userId, scriptId)` pair so the UI can reset history.
- `GET /welcome/buttons` (`server/routes.js:59`)
  - Handler: `chatController.getWelcomeButtons` (`server/controllers/chatController.js:446`)
  - Middleware: none (public).

## 2. Handler responsibilities and shared behaviors
### `startChat`
1. Input validation (`server/controllers/chatController.js:228-247`): requires `req.userId`, a prompt, and an editable `scriptId` resolved via `loadScriptOrThrow` + `verifyScriptOwnership`.
2. Context & intent routing (`server/controllers/chatController.js:252-388`): merges enhanced context overrides, tracks `forceAppend`/`forceFullScript`, and runs the append/full-script/next-five-lines services before handing control to the general chat flow.
3. Default chat branch (`server/controllers/chatController.js:417-442`): instantiates `Chat` with `(userId, scriptId)` and returns the response from `Chat.processMessage`.
4. Error handling (`server/controllers/chatController.js:32-74`): `handleChatError` maps LangChain/OpenAI failures to consistent HTTP codes, including invalid format (400), missing scripts (404), and rate limits (429).

### Chat history helpers
- `getChatMessages` reads paginated rows via `chatMessageRepository.listByUser`, reverses them, and emits user/assistant pairs for the UI to render chronologically.
- `addChatMessage` always writes through `chatMessageRepository.create`, so the database record keeps the role and any metadata.
- `clearChatMessages` removes all records for `(userId, scriptId)` and returns a boolean to indicate if anything was deleted.

### `getWelcomeButtons`
- Returns the static onboarding buttons displayed by the UI while the user does nothing yet (`server/controllers/chatController.js:446-461`).

## 3. Persistence services
- `chatMessageRepository.listByUser` (`server/repositories/chatMessageRepository.js:4-18`): runs `prisma.chatMessage.findMany` filtered by user/script and sorted by `createdAt desc`.
- `chatMessageRepository.create` (`server/repositories/chatMessageRepository.js:18-73`): executes a raw `INSERT INTO chat_messages`, normalizes token/cost counts, and reads `LAST_INSERT_ID()` so callers immediately get the inserted rows ID.
- `chatMessageRepository.clearByUserAndScript` (`server/repositories/chatMessageRepository.js:86-95`): scopes `prisma.chatMessage.deleteMany` to the `(userId, scriptId)` combination.

## 4. LangChain chain registration
- `ChainFactory` (`server/controllers/langchain/chains/ChainFactory.js:1-24`) registers every active intentincluding script conversation, reflection, general conversation, and the idea chainson the shared `chainRegistry` and logs its status at startup.
- `IntentRouter` (`server/controllers/langchain/router/index.js:1-44`) imports the factory to guarantee initialization, looks up the chain class by intent, and falls back to `DefaultChain` when nothing matches.
- `Chat.processMessage` (`server/controllers/chat/Chat.js:39-176`) resolves an intent, builds context, and passes the prompt through `router.route`, so every `/chat` request goes through one of the registered chains.

## 5. Shared helpers and flow anchors
- Authentication & ownership: `validateSession` plus `requireScriptOwnership` guard every chat endpoint (`server/routes.js:82-115`) and `verifyScriptOwnership` is invoked again inside the controller.
- Script loading: `loadScriptOrThrow` ensures `startChat` operates on editable scripts and shares the resolved `scriptId`/title across services.
- Script services: `generateFullScript` and `generateAppendPage` wrap dedicated chains, then return validated payloads via `buildValidatedChatResponse` before `startChat` replies.
- Intent utilities: `isFullScriptRequest`, `isAppendPageRequest`, and `isNextFiveLinesRequest` centralize the heuristics that trigger each special path.
- Response validation: `buildValidatedChatResponse` guarantees every script-oriented payload contains the expected metadata, formatted script, and validation status.

## 6. LangChain chain inventory
- `ScriptAppendChain` (`server/controllers/langchain/chains/script/ScriptAppendChain.js:1-82`, intent `SCRIPT_CONVERSATION`): merges the append prompt with the script header/content/collections, enforces 16-20 XML-style lines, and returns metadata such as `appendWithScript` plus formatted script text.
- `ScriptReflectionChain` (`server/controllers/langchain/chains/script/ScriptReflectionChain.js:1-65`, intent `SCRIPT_REFLECTION`): instructs the model to reflect on themes/risks instead of producing lines, includes script context/collections, and tags metadata with `reflection: true`.
- `ScriptNextLinesChain` (`server/controllers/langchain/chains/script/ScriptNextLinesChain.js:1-201`, intent `NEXT_FIVE_LINES`): uses function-calling (`provide_next_lines`) to get `formattedScript` + `assistantResponse`, normalizes the payload, and validates it with `validateAiResponse`/`buildContractMetadata` before returning.
- `DefaultChain` (`server/controllers/langchain/chains/base/DefaultChain.js:1-135`, intent `GENERAL_CONVERSATION`): supplies general assistance prompts, optionally includes script context/collections, and falls back to a canned reply when execution fails.
- Idea chains (`SceneIdeaChain`, `CharacterIdeaChain`, `LocationIdeaChain`, `ThemeIdeaChain` in `server/controllers/langchain/chains/scene/*.js` and `item/*.js`): all derive from `createTaggedItemIdeaChain`, emit JSON `{ title, description }`, and inject script metadata, current/other items, and collections into the prompt.
- `IntentClassifier` (`server/controllers/langchain/chains/system/IntentClassifier.js:1-52`): not part of `chainRegistry` but used by `Chat` to classify prompts into intents, returning `{ intent, confidence, reason }` parsed from JSON.
- `BaseChain` (`server/controllers/langchain/chains/base/BaseChain.js:1-308`): implements shared behavior such as message validation, optional history replay via `chatMessageRepository.listByUser`, prompt-system injection (`COMMON_PROMPT_INSTRUCTIONS`), AI calls via `ai.generateCompletion`, token/cost logging, and question generation.

## 7. Non-chain helpers & services
- `Chat` (`server/controllers/chat/Chat.js:1-176`) orchestrates the conversation: it loads the script via `ScriptManager`, calls `IntentClassifier`, builds a context bundle (history, metadata, overrides), routes through `IntentRouter`, and wraps the AI response with `buildAiResponse` while delegating history persistence to `ChatHistoryManager`.
- `ChatHistoryManager` (`server/controllers/chat/ChatHistoryManager.js:1-136`) wraps `chatMessageRepository` to read, save, and clear history within the `(userId, scriptId)` scope while skipping writes when `aiUsage.loggedByBaseChain` is already true.
- Script services (`server/controllers/script-services/AppendPageService.js:1-68` and `server/controllers/script-services/FullScriptService.js:1-66`) drive the structured append/full-script flows consumed by `startChat` when the prompt explicitly requests them.
- `chatMessageRepository` (`server/repositories/chatMessageRepository.js:4-95`) remains the single Prisma DB adapter for histories and usage logging.
- Context & intent helpers (`chat/chainConfigUtils.js`, `script/context-builder.service.js`, `intentUtils.js`, `aiResponse.js`) feed consistent flags, overrides, and metadata into `Chat` and `startChat`.

## 8. Prompt registry
- `createPrompt` (`shared/promptRegistry.js:14`) applies defaults (`attachScriptContext`, `expectsFormattedScript`, `scriptMutation`) so each definition only needs to declare the fields that change.
- `PROMPT_REGISTRY` (`shared/promptRegistry.js:22-304`) lists the system prompts (`initial`, `status`, `ideas`, `structure`, `production`) plus the service prompts (`append-page`, `next-five-lines`, scene/character/location/theme ideas), with each entry describing the route, intent, instructions, and JSON expectations.
- The registry is consumed via `getPromptById` (`shared/promptRegistry.js:305`); for example, `chatController` reads the `next-five-lines` prompt at startup (`server/controllers/chatController.js:220-442`) so it can keep the prompt metadata synchronized with the chains.

## 9. Architecture Q&A
### 1. Runtime & boundaries
- Single service: `ScriptPalServer` (server/server.js:45-230) boots one Express app, adds middleware, and serves both static/UI assets and API routes, so everything lives in the same Node process.
- LangChain runs in-process: `ChainFactory` and `IntentRouter` register and instantiate chains directly, without any remote adapter (`server/controllers/langchain/chains/ChainFactory.js:1-24`, `server/controllers/langchain/router/index.js:1-44`).
- No queue workers: `startChat` is synchronous (`server/controllers/chatController.js:220-442`), and the only retries/backoff happen inside the OpenAI wrapper (`server/services/AIClient.js:55-150`); every HTTP request blocks until the AI call returns or hits its timeout.

### 2. Request lifecycle clarity
- The lifecycle inside `startChat` validates the prompt/user/script, optionally runs script services, and finally calls `Chat.processMessage` (`server/controllers/chatController.js:220-442`, `server/controllers/chat/Chat.js:39-176`).
- `BaseChain.execute` logs the assistant response (`server/controllers/langchain/chains/base/BaseChain.js:189-284`), returns `aiUsage`, and only then does `ChatHistoryManager` persist the interaction if `aiUsage.loggedByBaseChain` is false (`server/controllers/chat/ChatHistoryManager.js:24-59`).
- Retries happen inside `AIClient.generateCompletion` (`server/services/AIClient.js:55-150`), and there is no broader idempotency guard, so repeated POSTs can log duplicate messages if the client retries the whole call.

### 3. State & ownership model
- Scripts are per-user, versioned (`server/models/script.js:1-160`), and track a `status` enum with `draft`, `in_progress`, or `complete` (`docs/database.md:27`, `docs/scriptpal-data-schema.md:30`). `requireScriptOwnership` (and the same check inside `chatController`) enforces the `(userId, scriptId)` scope.
- Chat history rows keep `(userId, scriptId)` plus roles, meaning there can be many chat sessions tied to one script but no shared state across scripts (`server/repositories/chatMessageRepository.js:4-95`).

### 4. Chat history mechanics
- Chains only replay the last few rows (`limit=3` in `BaseChain.getChatHistory` and `ChatHistoryManager.getHistory`), so there is no summarization; history is just the most recent entries reversed and flattened (`server/controllers/langchain/chains/base/BaseChain.js:35-76`, `server/controllers/chat/ChatHistoryManager.js:81-119`).
- There is no automatic truncation beyond those three entries, nor is there any summarization logic.
- `ChatHistoryManager.saveInteraction` checks `aiUsage.loggedByBaseChain` (set by `BaseChain.execute`) so the assistant reply is logged only once (`server/controllers/chat/ChatHistoryManager.js:24-59`).

### 5. Intent resolution details
- `Chat.processMessage` asks `IntentClassifier` for a JSON intent, validates it via `Chat.resolveIntent`, and runs heuristics when the classifier is missing or invalid (`server/controllers/langchain/chains/system/IntentClassifier.js:1-52`, `server/controllers/chat/Chat.js:60-110`).
- Only one intent fires per request; `IntentRouter` resolves a single chain class, and `forceChatFallback` returns to the general chat flow after semantic validation fails in the append/full-script helpers (`server/controllers/chatController.js:281-388`, `:417-442`).

### 6. Chain execution guarantees
- Schema validation is aggressive: function payloads and JSON responses go through `parseFunctionPayload`, `validateResponse`, and `validateAiResponse`, so malformed payloads trigger exceptions rather than partial mutations (`server/controllers/langchain/chains/base/BaseChain.js:187-284`, `server/controllers/langchain/chains/script/ScriptNextLinesChain.js:1-201`).
- Timeout handling comes from `BaseChain.buildMessageChain` (5-second race) and the configured OpenAI timeout in `AIClient` (`server/controllers/langchain/chains/base/BaseChain.js:208-216`, `server/services/AIClient.js:1-160`).
- Token/cost caps are enforced via the shared `AIClient` config, and `BaseChain.execute` records `aiUsage` per persisted row so every chain reports its usage (`server/services/AIClient.js:1-160`, `server/controllers/langchain/chains/base/BaseChain.js:243-284`).

### 7. Context construction
- `buildPromptContext` composes `buildScriptContextBundle`, filters overrides, and exposes flags such as `attachScriptContext`, `expectsFormattedScript`, and `chainConfig` (`server/controllers/script/context-builder.service.js:1-44`, `server/controllers/chat/contextUtils.js:1`).
- `Chat.buildContext` adds history, script metadata/collections, and protected overrides while disabling history for general chat (`server/controllers/chat/Chat.js:127-176`).
- Script mutation flows toggle `forceAppend`, `forceFullScript`, or `expectsFormattedScript` before sending the prompt to the appropriate chain so they see the right context.

### 8. AI abstraction layer
- `ai.generateCompletion` is a singleton wrapper over OpenAI chat completions (`server/lib/ai.js:1-12`, `server/services/AIClient.js:1-160`); no streaming or other LLMs are used.
- Telemetry (tokens, cost, response time) is tracked inside `AIClient` and forwarded into `BaseChain.execute` as `aiUsage`, linking each chat row to its OpenAI metrics (`server/services/AIClient.js:55-150`, `server/controllers/langchain/chains/base/BaseChain.js:243-284`).

### 9. Error & recovery strategy
- `handleChatError` surfaces user-friendly codes for invalid requests, missing scripts, and rate limits (`server/controllers/chatController.js:32-74`), while `AIClient.generateCompletion` already retries transient OpenAI failures (`server/services/AIClient.js:55-150`).
- Partial script mutations are blocked because `buildValidatedChatResponse` only returns when append/full-script responses validate, otherwise the request falls back to chat (`server/controllers/chatController.js:281-388`).
- There is no separate circuit breaker; rate-limit backoff is handled entirely inside `AIClient.generateCompletion`, and the controller does not queue or throttle requests itself.

### 10. Client assumptions
- `GET /chat/messages` and `ChatHistoryManager.getHistory` reorder assistant/user rows so the client can render alternating messages even though records only store roles (`server/controllers/chatController.js:76-123`, `server/controllers/chat/ChatHistoryManager.js:81-119`).
- Script outputs carry metadata such as `generationMode`, `formattedScript`, and `appendWithScript` when they originate from `ScriptAppendChain`, `ScriptNextLinesChain`, or the script services, allowing the UI to treat them as script pages instead of chat text (`server/controllers/langchain/chains/script/ScriptAppendChain.js:33-82`, `server/controllers/langchain/chains/script/ScriptNextLinesChain.js:1-201`, `server/controllers/script-services/AppendPageService.js:1-68`, `server/controllers/script-services/FullScriptService.js:1-66`).
- All LangChain work is proxied through the controller routes (`/chat`, `/chat/messages`, `/script/:id/.../ai/...`); the client never calls chain classes directly.
