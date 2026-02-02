# Next Five Lines - AI Prompt Flow Analysis

## Executive Summary

The "Next 5 Lines" feature requests the AI to continue the user's script with exactly five new formatted lines. This document traces the complete flow from HTTP request to AI response, analyzes the prompt construction, and provides recommendations for improving consistency and quality.

---

## 1. Request Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REQUEST FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP Request                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  NextLinesController.trigger()                                              │
│       │                                                                     │
│       ├──► ScriptManager.getScript(scriptId)                               │
│       │                                                                     │
│       ├──► buildPromptContext()                                            │
│       │       ├── buildScriptContextPayload()                              │
│       │       │       └── normalizeScriptForPrompt()                       │
│       │       └── getScriptCollections()                                   │
│       │                                                                     │
│       ▼                                                                     │
│  IntentRouter.route()                                                       │
│       │                                                                     │
│       ▼                                                                     │
│  ScriptNextLinesChain.run()                                                │
│       │                                                                     │
│       ├──► buildMessages()                                                 │
│       │       ├── buildScriptHeader()                                      │
│       │       ├── formatScriptCollections()                                │
│       │       └── Compose system + user messages                           │
│       │                                                                     │
│       ▼                                                                     │
│  BaseChain.execute()                                                        │
│       │                                                                     │
│       ├──► addCommonInstructions()                                         │
│       ├──► buildMessageChain() (adds history)                              │
│       │                                                                     │
│       ▼                                                                     │
│  ai.generateCompletion() → OpenAI API                                       │
│       │                                                                     │
│       ▼                                                                     │
│  ScriptNextLinesChain.formatResponse()                                      │
│       │                                                                     │
│       ├──► parseFunctionPayload()                                          │
│       ├──► normalizeFormattedScript()                                      │
│       └──► validateAiResponse()                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Files & Responsibilities

| File | Responsibility |
|------|---------------|
| `server/controllers/nextLinesController.js` | HTTP endpoint, context assembly |
| `server/controllers/langchain/chains/script/ScriptNextLinesChain.js` | Chain logic, message building, response formatting |
| `server/controllers/langchain/chains/base/BaseChain.js` | Common execution, history, API call |
| `shared/promptRegistry.js` | Prompt definitions (system + user prompts) |
| `server/controllers/contextBuilder.js` | Script context assembly |
| `server/controllers/langchain/chains/helpers/ChainInputUtils.js` | Script normalization |
| `server/controllers/langchain/chains/helpers/ScriptCollectionsFormatter.js` | Collections formatting |

---

## 3. Prompt Construction

### 3.1 System Instruction (from promptRegistry.js)

```
You are the script continuation specialist.
- Respond only in JSON with two keys: "formattedScript" and "assistantResponse".
  - "formattedScript" must contain exactly five new lines in proper XML-like tags.
  - Each line is exactly one tag and counts toward the five-line total.
  - Each line must use the valid tags (header, action, speaker, dialog, directions, chapter-break).
  - "assistantResponse" should briefly describe the new script (less than 50 words).
- Escape any double quotes inside JSON strings as \".
- Do not include additional text outside the JSON envelope.
- Refer to the existing context before writing so that continuity is preserved.
- Avoid rewriting previous lines and do not exceed five new lines.
```

### 3.2 User Prompt (from promptRegistry.js)

```
Write the next five lines of the user script.
Each line must use the standard tags (header, action, speaker, dialog, directions, chapter-break).
The formatted script response MUST return only xml style tags like: 
<speaker>NICK</speaker>
<dialog>Hi!</dialog>
```

### 3.3 Function Schema (from ScriptNextLinesChain.js)

```javascript
{
  name: 'provide_next_lines',
  description: 'Return five new script lines plus rationale.',
  parameters: {
    type: 'object',
    properties: {
      formattedScript: {
        type: 'string',
        description: 'Five script lines wrapped in validated tags (<header>, <action>, <speaker>, <dialog>, <directions>, <chapter-break>).'
      },
      assistantResponse: {
        type: 'string',
        description: 'Why the new lines fit and how they connect to context.'
      }
    },
    required: ['formattedScript', 'assistantResponse']
  }
}
```

### 3.4 Context Blocks Added

The chain assembles these context blocks:

```
Script Title: {title}
Script Description: {description}

Related Collections:
Scenes:
#1: Opening Scene — Description...

Characters:
#1: NICK — Main protagonist...

Locations:
#1: Coffee Shop — Downtown...

Themes:
#1: Redemption — ...

SCRIPT CONTEXT (do not repeat or rewrite existing lines):
<speaker>NICK</speaker>
<dialog>Hello there.</dialog>
<action>Nick walks to the door.</action>
...
```

### 3.5 Final Message Structure

```javascript
[
  { role: 'system', content: systemInstruction },
  { role: 'user', content: userPrompt + '\n\n' + scriptContext }
]
```

---

## 4. Current Issues & Weaknesses

### 4.1 Format Specification Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| **No format flow guidance** | AI doesn't know `speaker` should follow `action`, `dialog` follows `speaker` | HIGH |
| **No example sequence** | AI may produce unnatural format ordering | HIGH |
| **"Five lines" is ambiguous** | Does `<speaker>` + `<dialog>` count as 1 or 2 lines? | MEDIUM |
| **No context window guidance** | AI may repeat content from 50+ lines ago | MEDIUM |
| **Chapter-break confusion** | When is it appropriate? AI often overuses or ignores | LOW |

### 4.2 Prompt Redundancy

The same instructions appear in:
- `systemInstruction` in promptRegistry
- `userPrompt` in promptRegistry  
- `function.description` in ScriptNextLinesChain
- `addCommonInstructions()` in BaseChain

This creates potential for:
- Conflicting instructions
- Wasted tokens
- Maintenance burden

### 4.3 Context Quality Issues

| Issue | Root Cause |
|-------|------------|
| **Full script sent** | No truncation to recent lines; wastes tokens on early irrelevant content |
| **Collections not filtered** | All characters sent even if only 2 are in recent scene |
| **No scene detection** | AI doesn't know which scene is "current" |
| **No format statistics** | AI doesn't know "script has 80% dialog" |

### 4.4 Response Validation Gaps

```javascript
// Current validation only checks:
const validation = validateAiResponse(INTENT_TYPES.NEXT_FIVE_LINES, response);
```

What's NOT validated:
- Exact line count (5)
- Format distribution reasonableness
- Continuity with last line
- No repeated content from context

---

## 5. Recommendations

### 5.1 Enhanced System Prompt (HIGH PRIORITY)

```
You are the script continuation specialist.

FORMAT RULES:
- Respond ONLY in JSON: { "formattedScript": "...", "assistantResponse": "..." }
- "formattedScript" must contain EXACTLY 5 new lines.
- Valid tags: <header>, <action>, <speaker>, <dialog>, <directions>, <chapter-break>

FORMAT FLOW (follow this pattern):
- <speaker> is followed by <dialog> (dialogue exchange)
- <action> describes what happens between dialogue
- <directions> are parenthetical notes within dialogue
- <header> starts a new scene (INT./EXT.)
- <chapter-break> is rare, used for major story divisions

LINE COUNTING:
- Each XML tag = 1 line
- <speaker>NICK</speaker> = 1 line
- <dialog>Hello</dialog> = 1 line
- A dialogue exchange is typically: speaker (1) + dialog (1) = 2 lines

CONTINUITY:
- Read the LAST 5 lines of context carefully
- Continue the scene naturally
- Do NOT repeat any existing content
- Match the tone and pacing of the existing script

OUTPUT ONLY the JSON. No markdown, no explanation outside JSON.
```

### 5.2 Smart Context Truncation (HIGH PRIORITY)

Instead of sending the full script, send:

```javascript
const buildSmartContext = (scriptContent, options = {}) => {
  const { maxRecentLines = 20, includeFirstScene = true } = options;
  
  const lines = parseScriptLines(scriptContent);
  const lastLines = lines.slice(-maxRecentLines);
  
  // Find current scene header
  const lastSceneIndex = findLastSceneHeader(lastLines);
  
  return {
    recentContext: lastLines.join('\n'),
    currentScene: detectCurrentScene(lastLines, lastSceneIndex),
    formatStats: computeFormatDistribution(lines),
    activeCharacters: extractCharactersFromLines(lastLines)
  };
};
```

### 5.3 Structured Context Block (MEDIUM PRIORITY)

Replace freeform context with structured sections:

```
=== CURRENT SCENE ===
INT. COFFEE SHOP - DAY

=== ACTIVE CHARACTERS ===
NICK (protagonist), SARAH (love interest)

=== RECENT LINES (last 10) ===
<action>Nick sits at a table.</action>
<speaker>NICK</speaker>
<dialog>I didn't expect to see you here.</dialog>
<speaker>SARAH</speaker>
<dialog>Neither did I.</dialog>
...

=== YOUR TASK ===
Write the next 5 lines continuing this scene.
```

### 5.4 Example-Based Prompting (MEDIUM PRIORITY)

Add a concrete example to the prompt:

```
EXAMPLE INPUT (last 3 lines):
<speaker>NICK</speaker>
<dialog>What do you mean?</dialog>
<action>Sarah looks away.</action>

EXAMPLE OUTPUT (next 5 lines):
<speaker>SARAH</speaker>
<dialog>I thought you knew.</dialog>
<directions>(beat)</directions>
<speaker>NICK</speaker>
<dialog>Knew what?</dialog>

Now continue the user's script:
```

### 5.5 Post-Generation Validation (HIGH PRIORITY)

Add validation in `formatResponse()`:

```javascript
const validateLineCount = (formattedScript) => {
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>/g;
  const matches = formattedScript.match(tagPattern);
  return matches && matches.length === 5;
};

const validateFormatFlow = (formattedScript) => {
  const lines = parseToStructured(formattedScript);
  // Check speaker always followed by dialog
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].format === 'speaker' && lines[i + 1].format !== 'dialog') {
      return { valid: false, error: 'speaker must be followed by dialog' };
    }
  }
  return { valid: true };
};

const validateNoDuplication = (formattedScript, contextLines) => {
  const newLines = parseToStructured(formattedScript);
  for (const line of newLines) {
    if (contextLines.some(ctx => ctx.content === line.content)) {
      return { valid: false, error: 'Duplicated content from context' };
    }
  }
  return { valid: true };
};
```

### 5.6 Temperature Tuning (LOW PRIORITY)

Current: `temperature: 0.4`

Recommendation:
- For consistent format adherence: `0.2 - 0.3`
- For creative continuation: `0.5 - 0.7`

Consider making this configurable based on user preference.

---

## 6. Proposed Improved Prompt

```javascript
const IMPROVED_SYSTEM_INSTRUCTION = `
You are a professional screenwriter continuing a script.

RESPONSE FORMAT:
Return ONLY valid JSON:
{
  "formattedScript": "<exactly 5 lines in XML tags>",
  "assistantResponse": "<brief explanation, under 40 words>"
}

VALID TAGS (use ONLY these):
- <header> - Scene heading (INT./EXT. LOCATION - TIME)
- <action> - Action/description lines
- <speaker> - Character name (ALL CAPS)
- <dialog> - Spoken dialogue
- <directions> - Parenthetical direction
- <chapter-break> - Major story division (rare)

SCRIPT GRAMMAR:
1. <speaker> MUST be followed by <dialog>
2. <directions> goes between <speaker> and <dialog> if needed
3. <action> describes what happens, not what's said
4. Never start with <dialog> (needs <speaker> first)

CONTINUATION RULES:
- Read the last 5 context lines carefully
- Continue the scene naturally
- Never repeat existing content
- Match the established tone
- Count: Each tag = 1 line. Total must be exactly 5.
`;

const IMPROVED_USER_PROMPT = `
Continue this script with exactly 5 new lines.

EXAMPLE:
Context ends with:
<speaker>NICK</speaker>
<dialog>What happened?</dialog>

Good continuation (5 lines):
<action>Sarah hesitates.</action>
<speaker>SARAH</speaker>
<dialog>It's complicated.</dialog>
<speaker>NICK</speaker>
<dialog>Try me.</dialog>

Now continue the user's script:
`;
```

---

## 7. Implementation Priority

| Change | Effort | Impact | Priority |
|--------|--------|--------|----------|
| Enhanced system prompt with format flow | Low | High | P0 |
| Post-generation line count validation | Low | High | P0 |
| Smart context truncation (last N lines) | Medium | High | P1 |
| Example-based prompting | Low | Medium | P1 |
| Structured context blocks | Medium | Medium | P2 |
| Format flow validation | Medium | Medium | P2 |
| Temperature configurability | Low | Low | P3 |

---

## 8. Testing Checklist

After implementing changes, verify:

- [ ] AI returns exactly 5 lines
- [ ] `<speaker>` is always followed by `<dialog>`
- [ ] No content duplicated from context
- [ ] Tone matches existing script
- [ ] Scene continuity maintained
- [ ] JSON parsing succeeds 100%
- [ ] Response time acceptable (<3s)

---

## 9. Metrics to Track

| Metric | Target |
|--------|--------|
| Exact 5-line compliance | >95% |
| Format flow violations | <5% |
| Content duplication | 0% |
| JSON parse failures | 0% |
| User regeneration rate | <20% |

---

## Appendix: Current vs. Proposed Token Usage

| Component | Current Tokens | Proposed Tokens |
|-----------|---------------|-----------------|
| System prompt | ~200 | ~350 |
| User prompt | ~50 | ~150 |
| Full script context | 500-5000+ | 200-400 (truncated) |
| Collections | 100-500 | 50-150 (filtered) |
| **Total** | **850-5750** | **750-1050** |

Proposed approach uses **fewer tokens** while providing **better guidance**.
