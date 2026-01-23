# Chat Routing Implementation Plan

## 1. Goal
Split the current “everything else” ChatManager path into two distinct flows:
- **Conversational** (no script append) — renders replies without touching script content.
- **Append-with-script** — when the assistant replies with actionable script additions.

This makes intent handling clearer, drives better instrumentation, and prepares for future workflows (e.g., append confirmations or scheduled autosaves).

## 2. Signals & Intent
1. **Server change** (`server/controllers/chat/Chat.js`): The classifier now only returns `SCRIPT_CONVERSATION` or `GENERAL_CONVERSATION`. `Chat.processMessage` uses that intent to decide whether the script context should be attached when building the routing context; there is no intent awareness on the front end.
2. **Classifier prompt** (`server/controllers/langchain/chains/system/IntentClassifier.js`): The system instruction now lists just the two valid intents and asks the model to respond with JSON `{ intent: 'SCRIPT_CONVERSATION' | 'GENERAL_CONVERSATION', reason: '...' }`. The resolved intent is passed to `router.route`, and the router never needs to mutate the prompt itself.
3. **Router integration** (`router.route`): Use the AI classifier’s result to fetch the correct chain and proceed with the existing message-building/execution flow; fall back to heuristics only when the classifier fails or returns poor confidence, logging the warning.

## 3. Client-side flow updates NO CHANGES
The widget continues to call the chat endpoint unchanged; all script-append decisions live entirely on the server. Intent names are a backend-only signal, so the front-end remains unaware of the routing split.
