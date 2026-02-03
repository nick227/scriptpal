# AI Prompt Construction Analysis

> How prompts are built, when script context is attached, and the flow from registry to AI.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prompt Registry](#2-prompt-registry)
3. [Script-Generating Chains](#3-script-generating-chains)
4. [Context Building Utilities](#4-context-building-utilities)
5. [Message Construction Flow](#5-message-construction-flow)
6. [Context Variable Reference](#6-context-variable-reference)
7. [Truncation Strategy](#7-truncation-strategy)
8. [Visual Diagrams](#8-visual-diagrams)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROMPT CONSTRUCTION FLOW                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  promptRegistry.js          Chain Files                  AI Provider    │
│  ┌─────────────────┐       ┌──────────────────┐       ┌─────────────┐  │
│  │ Prompt Defs     │──────▶│ buildMessages()  │──────▶│ Anthropic   │  │
│  │ - systemInstr.  │       │ - System prompt  │       │ API Call    │  │
│  │ - userPrompt    │       │ - User prompt    │       └─────────────┘  │
│  │ - metadata      │       │ - Context attach │                        │
│  └─────────────────┘       └──────────────────┘                        │
│                                    ▲                                    │
│                                    │                                    │
│                            ┌───────┴───────┐                           │
│                            │ Context Utils │                           │
│                            │ - scriptHeader│                           │
│                            │ - collections │                           │
│                            │ - truncation  │                           │
│                            └───────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Prompt Registry | `shared/promptRegistry.js` | Defines prompts, system instructions, metadata |
| Chain Files | `server/controllers/langchain/chains/script/` | Builds messages, attaches context, executes AI |
| BaseChain | `server/controllers/langchain/chains/base/BaseChain.js` | Shared functionality, history merging |
| Context Utils | `server/controllers/langchain/chains/helpers/` | Script header, collections formatting |

---

## 2. Prompt Registry

### Prompt Definition Factory

```javascript
// shared/promptRegistry.js
const createPrompt = (definition) => ({
  attachScriptContext: false,      // Include script content in prompt?
  expectsFormattedScript: false,   // Output is XML-tagged script?
  scriptMutation: SCRIPT_MUTATION.NONE,  // NONE | APPEND
  ...definition
});
```

### Key Metadata Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier |
| `route` | string | API endpoint pattern |
| `intent` | string | Intent classification |
| `attachScriptContext` | boolean | Whether to include script content |
| `expectsFormattedScript` | boolean | Whether output is formatted script |
| `scriptMutation` | enum | Type of script change |
| `systemInstruction` | string | Full system prompt |
| `userPrompt` | string | Default user message |

### Script-Generating Prompt Definitions

#### `next-five-lines`

```javascript
createPrompt({
  id: 'next-five-lines',
  intent: 'NEXT_FIVE_LINES',
  attachScriptContext: true,
  expectsFormattedScript: true,
  scriptMutation: SCRIPT_MUTATION.APPEND,
  userPrompt: 'Write the next 5 lines continuing this script.',
  systemInstruction: `You are a screenplay continuation engine.

OUTPUT FORMAT
Return valid JSON: { "formattedScript": "...", "assistantResponse": "..." }
- "formattedScript": exactly 5-6 lines (each XML tag = 1 line)
- "assistantResponse": under 40 words

${VALID_TAGS_BLOCK}

${SCREENPLAY_GRAMMAR_V1}

LINE COUNTING
Each XML tag = 1 line. Output exactly 5-6 tags.

CONTEXT AWARENESS
- Read the script context carefully
- Continue naturally from the last line
- Match the tone and pacing`
})
```

#### `append-page`

```javascript
createPrompt({
  id: 'append-page',
  intent: 'APPEND_SCRIPT',
  attachScriptContext: true,
  expectsFormattedScript: true,
  scriptMutation: SCRIPT_MUTATION.APPEND,
  userPrompt: 'Write the next page (12-16 lines) continuing this script.',
  systemInstruction: `You are a screenplay continuation engine.

OUTPUT FORMAT
Return valid JSON only:
{ "formattedScript": "<12-16 lines>", "assistantResponse": "<under 40 words>" }

${VALID_TAGS_BLOCK}

${SCREENPLAY_GRAMMAR_V1}

LINE COUNTING
Each XML tag = 1 line. Output 12-16 tags total.

...`
})
```

### Shared Grammar Constants

```javascript
// shared/langchainConstants.js

export const VALID_TAGS_BLOCK = `VALID TAGS (use only these):
- <header>SCENE HEADING</header>
- <action>Action description</action>
- <speaker>CHARACTER NAME</speaker>
- <dialog>Spoken words</dialog>
- <directions>(parenthetical)</directions>`;

export const SCREENPLAY_GRAMMAR_V1 = `SCREENPLAY GRAMMAR RULES:
1. <speaker> MUST be followed by <dialog>
2. <directions> only appears between <speaker> and <dialog>
3. Never output <dialog> without a preceding <speaker>
4. Each XML tag = one line`;

export const SCRIPT_CONTEXT_PREFIX = 
  'SCRIPT CONTEXT (do not repeat or rewrite existing lines):';
```

---

## 3. Script-Generating Chains

### 3.1 ScriptNextLinesChain

**Purpose**: Generate the next 5-6 lines of script.

**File**: `server/controllers/langchain/chains/script/ScriptNextLinesChain.js`

#### System Prompt Source
From prompt registry (`next-five-lines`) via `context.systemInstruction`

#### Message Construction

```javascript
buildMessages(context, prompt, retryNote = '') {
  // 1. Build script header
  const scriptHeader = buildScriptHeader(
    context?.scriptTitle, 
    context?.scriptDescription
  );
  
  // 2. Format collections (scenes, characters, etc.)
  const collectionBlock = formatScriptCollections(context?.scriptCollections);
  
  // 3. Truncate script content to last 20 lines
  const truncatedContent = truncateToRecentLines(
    context?.scriptContent, 
    MAX_CONTEXT_LINES  // 20
  );
  
  // 4. Build context block
  const scriptContentBlock = truncatedContent
    ? `${SCRIPT_CONTEXT_PREFIX}\n${truncatedContent}`
    : '';
  
  const contextBlocks = [collectionBlock, scriptContentBlock]
    .filter(Boolean)
    .join('\n\n');
  
  const scriptContext = contextBlocks
    ? `${scriptHeader}\n\n${contextBlocks}`
    : 'No script content available.';
  
  // 5. Build user message (with optional retry note)
  const userContent = retryNote
    ? `${prompt}\n\n${retryNote}\n\n${scriptContext}`
    : `${prompt}\n\n${scriptContext}`;
  
  return [{
    role: 'system',
    content: context?.systemInstruction
  }, {
    role: 'user',
    content: userContent
  }];
}
```

#### Truncation Logic

```javascript
const MAX_CONTEXT_LINES = 20;

const truncateToRecentLines = (scriptContent, maxLines) => {
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
  const matches = scriptContent.match(tagPattern);
  
  if (!matches || matches.length <= maxLines) {
    return scriptContent;
  }
  
  // Keep only the last N lines
  return matches.slice(-maxLines).join('\n');
};
```

---

### 3.2 ScriptPageAppendChain

**Purpose**: Generate a full page (12-16 lines) of script.

**File**: `server/controllers/langchain/chains/script/ScriptPageAppendChain.js`

#### System Prompt Source
From prompt registry (`append-page`) via `context.systemInstruction`

#### Message Construction

```javascript
buildMessages(context, prompt, retryNote = '') {
  const userPrompt = retryNote
    ? `${prompt}\n\nCorrection: ${retryNote}`
    : prompt;
  
  // Truncate to last 30 lines (more context than next-five-lines)
  const truncatedContent = truncateToRecentLines(
    context.scriptContent, 
    MAX_CONTEXT_LINES  // 30
  );
  
  const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
  const collectionBlock = formatScriptCollections(context?.scriptCollections);
  const scriptContentBlock = truncatedContent
    ? `${SCRIPT_CONTEXT_PREFIX}\n${truncatedContent}`
    : '';
  
  const contextBlocks = [collectionBlock, scriptContentBlock]
    .filter(Boolean)
    .join('\n\n');
  
  const content = contextBlocks
    ? `${userPrompt}\n\n${scriptHeader}\n\n${contextBlocks}`
    : userPrompt;
  
  return [{
    role: 'system',
    content: context?.systemInstruction || SYSTEM_INSTRUCTION
  }, {
    role: 'user',
    content: content
  }];
}
```

---

### 3.3 ScriptFullChain

**Purpose**: Generate a complete multi-page script (5-6 pages).

**File**: `server/controllers/langchain/chains/script/ScriptFullChain.js`

#### System Prompt Source
Inline constant (not from registry):

```javascript
const SYSTEM_INSTRUCTION = `You are a screenplay architect.
- Respond only in JSON with two keys: "formattedScript" and "assistantResponse".
  - "formattedScript" must contain 5-6 new pages of script lines using valid tags.
  - Treat each "<chapter-break></chapter-break>" as a page boundary (roughly 15-16 lines per page).
  - "assistantResponse" should be a short, simple chat response (under 40 words).
- Escape any double quotes inside JSON strings as \\".
- Focus on a clear story arc (setup, escalation, turning point, resolution).
- Do not rewrite what has already happened; pick up exactly where the script left off.
- Do not include markdown, commentary, numbering, or prose outside the JSON envelope.`;
```

#### Message Construction

```javascript
buildMessages(context, prompt, retryNote = '') {
  const userPrompt = retryNote 
    ? `${prompt}\n\nCorrection: ${retryNote}` 
    : prompt;
  
  // FULL script content - no truncation
  const scriptContent = context?.scriptContent || '';
  
  const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
  const collectionBlock = formatScriptCollections(context?.scriptCollections);
  
  const contextBlocks = [
    collectionBlock,
    scriptContent ? `${SCRIPT_CONTEXT_PREFIX}\n${scriptContent}` : ''
  ].filter(Boolean).join('\n\n');
  
  const content = contextBlocks
    ? `${userPrompt}\n\n${scriptHeader}\n\n${contextBlocks}`
    : userPrompt;
  
  return [{
    role: 'system',
    content: context?.systemInstruction || SYSTEM_INSTRUCTION
  }, {
    role: 'user',
    content
  }];
}
```

---

### 3.4 ScriptAppendChain

**Purpose**: Generic script append (used as fallback).

**File**: `server/controllers/langchain/chains/script/ScriptAppendChain.js`

#### System Prompt Source
Inline constant:

```javascript
const SYSTEM_INSTRUCTION = `You are a scriptwriting assistant tasked with appending scripts.
- Output ONLY new script lines.
- Return 12-16 lines.
- Each line must be a single XML-style script tag using only: ${VALID_TAGS}.
- Do not include markdown, numbering, or commentary.
- Do not rewrite or repeat existing lines.`;
```

#### Message Construction

```javascript
buildMessages(context, prompt) {
  const scriptContent = context?.scriptContent || '';
  const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
  const collectionBlock = formatScriptCollections(context?.scriptCollections);
  
  const contextBlocks = [
    collectionBlock,
    scriptContent ? `${SCRIPT_CONTEXT_PREFIX}\n${scriptContent}` : ''
  ].filter(Boolean).join('\n\n');
  
  const scriptSnippet = contextBlocks
    ? `${prompt}\n\n${scriptHeader}\n\n${contextBlocks}`
    : prompt;
  
  const messages = [{
    role: 'system',
    content: context?.systemInstruction || SYSTEM_INSTRUCTION
  }, {
    role: 'user',
    content: scriptSnippet
  }];
  
  // Note: This chain adds common instructions (others don't)
  return this.addCommonInstructions(messages);
}
```

---

## 4. Context Building Utilities

### Script Header Builder

```javascript
// server/controllers/langchain/chains/helpers/ScriptPromptUtils.js

export const buildScriptHeader = (scriptTitle, scriptDescription) => {
  const title = scriptTitle || 'Untitled Script';
  const description = scriptDescription || '';
  return `Script Title: ${title}\nScript Description: ${description}`;
};
```

**Output Example:**
```
Script Title: The Matrix Reloaded
Script Description: Neo discovers the truth about the Matrix.
```

### Collections Formatter

```javascript
// server/controllers/langchain/chains/helpers/ScriptCollectionsFormatter.js

export const formatScriptCollections = (collections) => {
  if (!collections || typeof collections !== 'object') {
    return '';
  }
  
  const blocks = [
    formatCollection('Scenes', collections.scenes),
    formatCollection('Characters', collections.characters),
    formatCollection('Locations', collections.locations),
    formatCollection('Themes', collections.themes)
  ].filter(Boolean);
  
  if (blocks.length === 0) {
    return '';
  }
  
  return `Related Collections:\n${blocks.join('\n\n')}`;
};

const formatCollection = (label, items) => {
  if (!items || items.length === 0) return '';
  
  const formatted = items
    .map((item, i) => `#${i + 1}: ${item.name} — ${item.description || 'No description'}`)
    .join('\n');
  
  return `${label}:\n${formatted}`;
};
```

**Output Example:**
```
Related Collections:
Scenes:
#1: Opening Chase — Neo is pursued through the city
#2: Oracle Meeting — Neo seeks guidance

Characters:
#1: Neo — The One, searching for meaning
#2: Morpheus — Rebel leader, believes in Neo
```

---

## 5. Message Construction Flow

### Standard User Message Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [User Prompt]                                                   │
│ "Write the next 5 lines continuing this script."               │
│                                                                 │
│ [Retry Note] (only on retry)                                   │
│ "Correction: Previous output had dialog without speaker."      │
│                                                                 │
│ Script Title: The Matrix                                        │
│ Script Description: A hacker discovers reality is a simulation │
│                                                                 │
│ Related Collections:                                            │
│ Scenes:                                                         │
│ #1: Opening Chase — Neo is pursued through the city            │
│ Characters:                                                     │
│ #1: Neo — The One, searching for meaning                       │
│ #2: Trinity — Skilled fighter, loves Neo                       │
│                                                                 │
│ SCRIPT CONTEXT (do not repeat or rewrite existing lines):      │
│ <header>INT. NEBUCHADNEZZAR - DAY</header>                     │
│ <action>Neo sits alone in the cargo bay.</action>              │
│ <speaker>MORPHEUS</speaker>                                     │
│ <dialog>The Matrix has you, Neo.</dialog>                      │
│ <speaker>NEO</speaker>                                          │
│ <dialog>What does that mean?</dialog>                          │
│ ... (last N lines)                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Message Array Structure

```javascript
[
  {
    role: 'system',
    content: '...'  // System instruction from registry or inline
  },
  {
    role: 'user',
    content: '...'  // Constructed user message with context
  }
]
```

---

## 6. Context Variable Reference

### Variables Used Across All Chains

| Variable | Source | Description |
|----------|--------|-------------|
| `context.scriptTitle` | Script DB record | Title of the current script |
| `context.scriptDescription` | Script DB record | Description/logline |
| `context.scriptContent` | Script DB record | Full XML-tagged script content |
| `context.scriptCollections` | Collections API | Related scenes, characters, locations, themes |
| `context.systemInstruction` | Prompt registry | Overrides default system prompt |
| `context.scriptId` | Request params | Script identifier |

### Context Object Shape

```javascript
{
  scriptId: 123,
  scriptTitle: 'The Matrix',
  scriptDescription: 'A hacker discovers reality is a simulation',
  scriptContent: '<header>INT. OFFICE - DAY</header>\n<action>...</action>...',
  scriptCollections: {
    scenes: [{ name: '...', description: '...' }],
    characters: [{ name: '...', description: '...' }],
    locations: [{ name: '...', description: '...' }],
    themes: [{ name: '...', description: '...' }]
  },
  systemInstruction: '...',  // From getPromptById()
  attachScriptContext: true,
  userId: 'user-123'
}
```

---

## 7. Truncation Strategy

### Chain-Specific Limits

| Chain | Max Lines | Rationale |
|-------|-----------|-----------|
| `ScriptNextLinesChain` | 20 lines | Short continuation, recent context only |
| `ScriptPageAppendChain` | 30 lines | Full page, needs more context |
| `ScriptFullChain` | No limit | Multi-page generation, full context |
| `ScriptAppendChain` | No limit | Generic append, full context |

### Truncation Algorithm

```javascript
const truncateToRecentLines = (scriptContent, maxLines) => {
  // 1. Match all XML script tags
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
  const matches = scriptContent.match(tagPattern);
  
  // 2. If under limit, return as-is
  if (!matches || matches.length <= maxLines) {
    return scriptContent;
  }
  
  // 3. Keep only the LAST N tags
  return matches.slice(-maxLines).join('\n');
};
```

### Why Truncate?

1. **Token efficiency** — Reduces API costs and latency
2. **Relevance** — Recent context is most important for continuation
3. **Consistency** — AI performs better with focused context
4. **Prevents drift** — Avoids AI getting confused by early script content

---

## 8. Visual Diagrams

### Prompt Flow for `next-five-lines`

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           next-five-lines                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Router detects "continue" / "next lines" intent                    │
│                    │                                                    │
│                    ▼                                                    │
│  2. getPromptById('next-five-lines')                                   │
│     ┌───────────────────────────┐                                      │
│     │ systemInstruction         │                                      │
│     │ userPrompt                │                                      │
│     │ attachScriptContext: true │                                      │
│     └───────────────────────────┘                                      │
│                    │                                                    │
│                    ▼                                                    │
│  3. ScriptNextLinesChain.buildMessages(context, prompt)                │
│     ┌───────────────────────────────────────────┐                      │
│     │ a. buildScriptHeader(title, description)  │                      │
│     │ b. formatScriptCollections(collections)   │                      │
│     │ c. truncateToRecentLines(content, 20)     │                      │
│     │ d. Assemble user message                  │                      │
│     └───────────────────────────────────────────┘                      │
│                    │                                                    │
│                    ▼                                                    │
│  4. AI Provider (Anthropic)                                            │
│     ┌───────────────────────────┐                                      │
│     │ System: [grammar rules]   │                                      │
│     │ User: [prompt + context]  │                                      │
│     └───────────────────────────┘                                      │
│                    │                                                    │
│                    ▼                                                    │
│  5. formatResponse() → { message, script, metadata }                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### System Prompt Sources

```
┌──────────────────────────────────────────────────────────────────┐
│                    SYSTEM PROMPT SOURCES                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐       ┌─────────────────────┐          │
│  │  Prompt Registry    │       │   Inline Constants  │          │
│  │  (promptRegistry.js)│       │   (Chain files)     │          │
│  ├─────────────────────┤       ├─────────────────────┤          │
│  │ • next-five-lines   │       │ • ScriptFullChain   │          │
│  │ • append-page       │       │ • ScriptAppendChain │          │
│  │ • (other prompts)   │       │                     │          │
│  └─────────────────────┘       └─────────────────────┘          │
│           │                             │                        │
│           └──────────┬──────────────────┘                        │
│                      │                                           │
│                      ▼                                           │
│        context.systemInstruction (override)                      │
│                      │                                           │
│                      ▼                                           │
│              Final System Prompt                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Key Takeaways

1. **Prompt Registry** defines prompts declaratively with metadata
2. **Chains** build messages by assembling context components
3. **Script context** is attached based on `attachScriptContext` flag
4. **Truncation** keeps only recent lines for efficiency (20-30 lines)
5. **Collections** (scenes, characters, etc.) provide narrative context
6. **Retry notes** are injected when grammar validation fails

### Debugging Tips

To debug prompt construction:

1. **Check Network tab** — View the raw request/response
2. **Log in chain** — Add logging in `buildMessages()` to see assembled prompt
3. **Check context** — Verify `context.scriptContent` is populated
4. **Check truncation** — Ensure `truncateToRecentLines()` returns expected content

### Files Reference

| File | Purpose |
|------|---------|
| `shared/promptRegistry.js` | Prompt definitions |
| `shared/langchainConstants.js` | Grammar rules, tags, constants |
| `server/controllers/langchain/chains/script/ScriptNextLinesChain.js` | 5-line continuation |
| `server/controllers/langchain/chains/script/ScriptPageAppendChain.js` | Full page append |
| `server/controllers/langchain/chains/script/ScriptFullChain.js` | Multi-page generation |
| `server/controllers/langchain/chains/script/ScriptAppendChain.js` | Generic append |
| `server/controllers/langchain/chains/helpers/ScriptPromptUtils.js` | Header builder |
| `server/controllers/langchain/chains/helpers/ScriptCollectionsFormatter.js` | Collections formatter |
