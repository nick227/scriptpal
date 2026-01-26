# AI Chat Flow Summary

## Overview
1. **Intent Classification** – Each incoming user prompt runs through `Chat.processMessage`, which now calls `IntentClassifier` (system prompt plus script snippet) to determine whether the request should run as `SCRIPT_CONVERSATION` (AI sees the full script context) or `GENERAL_CONVERSATION` (chit-chat that avoids appending the script). Heuristics remain as a fallback when the classifier cannot produce a valid intent.
2. **Routing** – The resolved intent drives `router.route`, which now chooses `AppendScriptChain` for `SCRIPT_CONVERSATION`, the new `ScriptReflectionChain` for `SCRIPT_REFLECTION`, or `DefaultChain` for `GENERAL_CONVERSATION`. Both script modes include the current context before the AI call, but the reflection path explicitly instructs the assistant to analyze rather than append new lines, while `DefaultChain` stays lightweight.
3. **Chain Execution** – The chosen chain builds system/user messages (DefaultChain uses `COMMON_PROMPT_INSTRUCTIONS` + user prompt + script content), calls AI via `BaseChain.execute`, validates the response, and returns structured output (`response`, `metadata`, optional `questions`).
4. **Response Handling** – `Chat.processMessage` formats the result, persists chat history, and returns the normalized payload to the controller, which relays it back to the front-end. Only `SCRIPT_CONVERSATION` responses append to the script and may trigger `ScriptOperationsHandler`; the front end never inspects intent names or decides when to append content.

## Key Components
- `IntentClassifier` (new) – Light-weight chain that asks the model to respond with JSON intent plus confidence/reason before the main chain runs.
- `ChatManager` – Still handles rendering, history, user interactions, and delegating script operations; untouched by the intent routing change but reliant on the backend signal.
- `router` & `chainRegistry` – Map intents to chain classes; the router simply instantiates the chain and calls `run(context, prompt)`.

## Notable Behaviors
- The classifier only sets intent for the specific request and never touches the renderer/UI; the output remains the same JSON schema consumed by `ChatManager`.
- `DefaultChain` continues to include the latest `scriptContent` in the user prompt, ensuring the assistant always sees the current script context.
- `ScriptReflectionChain` reuses the script context but pairs it with a reflection-only instruction set so the model will not start writing new lines even when the user wants to discuss tone and ideas.
- The fallback heuristics now scan for critique/discussion keywords before choosing between the reflection and append paths so casual talk stays away from script editing when the classifier is unavailable.
- Heuristics remain as a safety net, but the AI classifier is the primary router now.

## Next Steps
1. Track classifier accuracy via logs/telemetry to ensure the new intent labels improve append routing.
2. Expand intents as needed (e.g., analyze vs. question-specific chains) by registering new chain classes.
3. Document this flow directly in onboarding guides (see `docs/chat-routing-implementation.md` for the full flow description) so new teammates understand how prompts, intents, chains, and orchestrator hooks collaborate.
