# Prompt Registry Analysis

> **Last Updated:** After P0 + P1 fixes applied

## Executive Summary

The `promptRegistry.js` file contains **17 prompts** across two categories:
- **SYSTEM** (5): Welcome, Status, Ideas, Structure, Production
- **SERVICE** (12): Script generation, item ideation, brainstorming

This analysis identifies redundancy patterns, inconsistent instruction styles, and provides recommendations for improvement.

### Completed Changes

| Priority | Change | Status |
|----------|--------|--------|
| P0 | `next-five-lines` grammar rules, example, context truncation | ✅ Done |
| P0 | `append-page` grammar rules, example, context truncation | ✅ Done |
| P1 | Shared `SCREENPLAY_GRAMMAR_V1` constant | ✅ Done |
| P1 | Templated 4 ideation prompts with tone differentiation | ✅ Done |
| P1 | Templated 4 brainstorm prompts | ✅ Done |

---

## 1. Prompt Inventory

| ID | Category | Intent | Output Format | Script Context |
|----|----------|--------|---------------|----------------|
| `initial` | SYSTEM | SCRIPT_CONVERSATION | Free text | No |
| `status` | SYSTEM | SCRIPT_CONVERSATION | Free text | No |
| `ideas` | SYSTEM | SCRIPT_CONVERSATION | Free text | Yes |
| `structure` | SYSTEM | SCRIPT_CONVERSATION | Free text | Yes |
| `production` | SYSTEM | SCRIPT_CONVERSATION | Free text | Yes |
| `append-page` | SERVICE | APPEND_SCRIPT | JSON | Yes |
| `next-five-lines` | SERVICE | NEXT_FIVE_LINES | JSON | Yes |
| `scene-idea` | SERVICE | SCENE_IDEA | JSON | Yes |
| `character-idea` | SERVICE | CHARACTER_IDEA | JSON | Yes |
| `location-idea` | SERVICE | LOCATION_IDEA | JSON | Yes |
| `theme-idea` | SERVICE | THEME_IDEA | JSON | Yes |
| `brainstorm-general` | SERVICE | BRAINSTORM_GENERAL | JSON array | No |
| `brainstorm-story` | SERVICE | BRAINSTORM_STORY | JSON array | No |
| `brainstorm-character` | SERVICE | BRAINSTORM_CHARACTER | JSON array | No |
| `brainstorm-location` | SERVICE | BRAINSTORM_LOCATION | JSON array | No |
| `brainstorm-title` | SERVICE | BRAINSTORM_TITLE | JSON | No |

---

## 2. Redundancy Analysis

### 2.1 Item Ideation Prompts — ✅ TEMPLATED

**Previous state:** 4 nearly identical prompts with ~400 wasted tokens

**Current state:** Single template with tone differentiation

```javascript
// Now in promptRegistry.js
const IDEATION_TONE = {
  scene: 'story structure, progression, and dramatic purpose',
  character: 'motivation, conflict, personality, and arc',
  location: 'atmosphere, constraints, visual identity, and mood',
  theme: 'underlying meaning, emotional resonance, and thematic arc'
};

const createIdeationPrompt = (itemType, extras = {}) => createPrompt({
  category: PROMPT_CATEGORIES.SERVICE,
  attachScriptContext: true,
  userPrompt: `Generate a ${itemType} idea based on the script context.`,
  systemInstruction: `You are a ${itemType} ideation engine.

OUTPUT FORMAT
Return valid JSON only: { "title": "...", "description": "..." }

FOCUS AREA
Consider: ${IDEATION_TONE[itemType]}

RULES
- Title: short, specific, evocative (3-6 words)
- Description: 2-4 sentences, aligned with script context
- No extra keys, no commentary outside JSON`,
  ...extras
});

// Usage
createIdeationPrompt('scene', { id: 'scene-idea', ... }),
createIdeationPrompt('character', { id: 'character-idea', ... }),
createIdeationPrompt('location', { id: 'location-idea', ... }),
createIdeationPrompt('theme', { id: 'theme-idea', ... }),
```

### 2.2 Brainstorm Prompts — ✅ TEMPLATED

**Previous state:** 5 prompts with 80% identical structure

**Current state:** Single template (4 array prompts + 1 object prompt)

```javascript
// Now in promptRegistry.js
const createBrainstormPrompt = (focus, targetCount, extras = {}) => createPrompt({
  category: PROMPT_CATEGORIES.SERVICE,
  userPrompt: `Generate ${targetCount} concise ${focus} ideas for the seed concepts.`,
  systemInstruction: `You are a brainstorm engine.

OUTPUT FORMAT
Return valid JSON only: an array of strings
Example: ["idea 1", "idea 2", "idea 3"]

FOCUS: ${focus}
TARGET COUNT: ${targetCount}

RULES
- Each item: concise, distinct, readable
- No objects, no nested structures
- No commentary outside the JSON array`,
  ...extras
});

// Usage
createBrainstormPrompt('word associations', '6-10 (target 8)', { id: 'brainstorm-general', ... }),
createBrainstormPrompt('story ideas', '1-3 (target 2)', { id: 'brainstorm-story', ... }),
...
```

Note: `brainstorm-title` returns `{ "title": "..." }` so remains separate.

### 2.3 Script Generation Prompts (NOW CONSISTENT ✅)

`append-page` and `next-five-lines` now share the same structure:

| Aspect | append-page | next-five-lines |
|--------|-------------|-----------------|
| Line count | 16-20 | Exactly 5 |
| Grammar rules | ✅ Explicit | ✅ Explicit |
| Example | ✅ Included | ✅ Included |
| Context truncation | ✅ 30 lines | ✅ 20 lines |
| Format clarity | High | High |

**Status:** Both prompts now have identical structure with screenplay grammar rules.

---

## 3. Instruction Style Inconsistencies

### 3.1 Role Definition Variations

```javascript
// Style A: "You are a [noun]"
"You are a calm, helpful script-writing assistant."
"You are a scene ideation assistant."
"You are a brainstorming assistant focused on word association."

// Style B: "You are a [adjective] [noun]"  
"You are an observant assistant providing a status report."
"You are a structure-focused script editor."
"You are a production-minded assistant."

// Style C: "You are a [noun] engine" (best for generation)
"You are a screenplay continuation engine."
```

**Recommendation:** Standardize on task-appropriate styles:
- **Generation tasks:** "You are a [X] engine" (deterministic feel)
- **Analysis tasks:** "You are a [X] analyst/editor"
- **Creative tasks:** "You are a [X] collaborator/assistant"

### 3.2 Instruction Format Variations

```javascript
// Style A: Bullet points with "Do NOT"
`- Do NOT ask the user questions.
- Do NOT generate new story ideas.
- Do NOT rewrite content.`

// Style B: Positive framing
`- Return only JSON with "title" and "description".
- Keep the title short and specific.`

// Style C: Section headers (best clarity)
`OUTPUT FORMAT
Return valid JSON only: ...

RULES
- Continue from the last line naturally
- Never repeat content from context`
```

**Recommendation:** Use section headers for complex prompts, bullet points for simple ones.

### 3.3 JSON Instruction Variations

```javascript
// Variation 1: Prose
"Return only JSON with 'title' and 'description'."

// Variation 2: Example inline
"Return JSON with a single key: 'title'."

// Variation 3: Explicit format
"Return valid JSON only:
{ \"formattedScript\": \"<5 lines>\", \"assistantResponse\": \"<under 40 words>\" }"
```

**Recommendation:** Always show the exact JSON shape:
```javascript
"Return valid JSON only: { \"key1\": \"...\", \"key2\": \"...\" }"
```

---

## 4. Missing Patterns (Status Update)

### 4.1 `append-page` Grammar Rules — ✅ FIXED

**Previous state:**
- Missing screenplay grammar rules (speaker → dialog)
- No line counting explanation
- No canonical example
- Full script context sent (token waste)

**Current state (implemented):**
- ✅ Explicit screenplay grammar in system prompt
- ✅ 12-line canonical example included
- ✅ Smart context truncation (30 lines max)
- ✅ Grammar validation in `ScriptPageAppendChain.js`

The prompt now matches the structure of `next-five-lines`:

```javascript
// Now in promptRegistry.js
systemInstruction: `You are a screenplay continuation engine.

OUTPUT FORMAT
Return valid JSON only:
{ "formattedScript": "<16-20 lines>", "assistantResponse": "<under 40 words>" }

SCREENPLAY GRAMMAR (enforced)
1. <speaker> MUST be followed by <dialog>
2. <directions> only appears between <speaker> and <dialog>
...

EXAMPLE
<action>The door creaks open. Nick peers inside.</action>
<speaker>NICK</speaker>
<dialog>Hello?</dialog>
...`
```

**Chain improvements (`ScriptPageAppendChain.js`):**
- `truncateToRecentLines()` — only sends last 30 lines
- `validateScreenplayGrammar()` — validates speaker→dialog rule
- Grammar validation logged in response metadata

### 4.2 SYSTEM Prompts Lack Output Length Guidance

Current:
```javascript
// status
"- Keep the tone factual and concise."

// ideas  
(no length guidance)

// structure
(no length guidance)
```

**Recommendation:** Add explicit length targets:
```javascript
"- Response length: 50-100 words"
"- Response length: 2-3 paragraphs"
```

### 4.3 Missing Error Handling Instructions

No prompts specify fallback behavior for:
- Empty script context
- Insufficient information
- Conflicting requirements

**Recommendation:** Add fallback instructions:
```javascript
"If script context is empty or insufficient:
- State what information is needed
- Do not invent placeholder content"
```

---

## 5. Token Efficiency Analysis

### 5.1 Current Token Estimates

| Prompt | System Tokens | User Tokens | Total |
|--------|---------------|-------------|-------|
| initial | ~80 | ~40 | ~120 |
| status | ~90 | ~30 | ~120 |
| ideas | ~100 | ~30 | ~130 |
| structure | ~120 | ~30 | ~150 |
| production | ~110 | ~30 | ~140 |
| append-page | ~180 | ~30 | ~210 |
| next-five-lines | ~450 | ~15 | ~465 |
| scene-idea | ~100 | ~50 | ~150 |
| character-idea | ~100 | ~50 | ~150 |
| location-idea | ~100 | ~50 | ~150 |
| theme-idea | ~100 | ~50 | ~150 |
| brainstorm-* | ~80 | ~40 | ~120 |

### 5.2 Optimization Opportunities

**High value:**
- Deduplicate ideation prompts: Save ~300 tokens in registry
- Deduplicate brainstorm prompts: Save ~250 tokens in registry

**Medium value:**
- Compress SYSTEM prompts: ~20% reduction possible
- Remove redundant "Do NOT" instructions where positive framing suffices

---

## 6. Recommended Architecture

### 6.1 Prompt Template System

```javascript
// Base templates
const TEMPLATES = {
  ideation: (itemType) => ({
    systemInstruction: `You are a ${itemType} ideation engine.
Return valid JSON: { "title": "...", "description": "..." }
Title: short, specific
Description: 2-4 sentences, script-aligned`,
    userPrompt: `Generate a ${itemType} idea based on context.`
  }),

  brainstorm: (focus, count) => ({
    systemInstruction: `You are a brainstorm engine.
Focus: ${focus}
Return: JSON array of ${count} strings`,
    userPrompt: `Generate ${count} ${focus} ideas.`
  }),

  scriptGeneration: (lineCount) => ({
    systemInstruction: `You are a screenplay continuation engine.
[... full grammar rules ...]
LINE COUNT: ${lineCount}`,
    userPrompt: `Continue the script with ${lineCount} lines.`
  })
};

// Usage
createPrompt({
  id: 'scene-idea',
  ...TEMPLATES.ideation('scene'),
  route: '/script/:scriptId/scenes/ai/scene-idea',
  intent: INTENT_TYPES.SCENE_IDEA
});
```

### 6.2 Shared Constants — ✅ IMPLEMENTED

```javascript
// Now in langchainConstants.js

export const VALID_TAGS_BLOCK = `VALID TAGS
<header>   Scene heading (INT./EXT. LOCATION - TIME)
<action>   Description of what happens
<speaker>  Character name in CAPS
<dialog>   Spoken words
<directions> Parenthetical (beat), (pause), (sotto)
<chapter-break> Major story division (rare)`;

export const SCREENPLAY_GRAMMAR_V1 = `SCREENPLAY GRAMMAR (enforced)
1. <speaker> MUST be followed by <dialog>
2. <directions> only appears between <speaker> and <dialog>
3. Never output <dialog> without a preceding <speaker>
4. <action> stands alone — describes visuals, not speech
5. Each XML tag = 1 line`;

export const JSON_ESCAPE_RULE = 'Escape quotes in JSON as \\". Output JSON only — no markdown, no extra text.';
```

**Usage in prompts:**
```javascript
// next-five-lines and append-page now reference:
systemInstruction: `...
${VALID_TAGS_BLOCK}

${SCREENPLAY_GRAMMAR_V1}
...`
```

This is now the **AI → Editor contract**. Any future generation prompt references these constants.

---

## 7. Priority Improvements

### P0 (Critical) — ✅ COMPLETED

| Change | Impact | Effort | Status |
|--------|--------|--------|--------|
| Add grammar rules to `append-page` | High | Low | ✅ Done |
| Add grammar rules to `next-five-lines` | High | Low | ✅ Done |
| Add context truncation | High | Low | ✅ Done |
| Add grammar validation in chains | High | Low | ✅ Done |

### P1 (Deduplication) — ✅ COMPLETED

| Change | Impact | Effort | Status |
|--------|--------|--------|--------|
| Create shared `SCREENPLAY_GRAMMAR_V1` constant | High | Low | ✅ Done |
| Template ideation prompts (4 → 1 template) | Medium | Medium | ✅ Done |
| Template brainstorm prompts (5 → 1 template) | Medium | Medium | ✅ Done |
| Add tone differentiation to ideation | Medium | Low | ✅ Done |

### P2 (Future)

| Change | Impact | Effort | Status |
|--------|--------|--------|--------|
| Add fallback instructions to all prompts | Low | Medium | Pending |
| Add length guidance to SYSTEM prompts | Low | Low | Pending |
| Standardize remaining SYSTEM prompt styles | Low | Medium | Pending |

---

## 8. Completed Action Items

### 8.1 ✅ `append-page` Fixed

**Changes applied:**

1. **Prompt rewritten** (`shared/promptRegistry.js`):
   - Explicit screenplay grammar rules
   - 12-line canonical example
   - Section headers for clarity
   - Minimal user prompt

2. **Chain updated** (`ScriptPageAppendChain.js`):
   - `truncateToRecentLines(content, 30)` — smart context truncation
   - `validateScreenplayGrammar()` — validates speaker→dialog rule
   - Grammar validation results in response metadata
   - Function schema stripped to structural only

### 8.2 ✅ `next-five-lines` Fixed (Previously)

Same improvements applied:
- Explicit grammar rules
- Canonical example
- Context truncation (20 lines)
- Hard 5-line validation
- Grammar validation

### 8.3 Remaining Items (P1)

**Ideation prompts (4 prompts to template):**
- `scene-idea`
- `character-idea`
- `location-idea`
- `theme-idea`

**Brainstorm prompts (5 prompts to template):**
- `brainstorm-general`
- `brainstorm-story`
- `brainstorm-character`
- `brainstorm-location`
- `brainstorm-title`

**JSON format standardization:**
```javascript
// Before
"Return only JSON with 'title' and 'description'."

// After
"Return valid JSON only: { \"title\": \"...\", \"description\": \"...\" }"
```

---

## 9. Metrics to Track

After implementing changes:

| Metric | Current | Target |
|--------|---------|--------|
| `append-page` grammar compliance | Unknown | >90% |
| `append-page` line count accuracy | Unknown | >95% |
| JSON parse failures | Unknown | 0% |
| User regeneration rate | Unknown | <15% |
| Average tokens per prompt | ~200 | ~180 |

---

## 10. Appendix: Prompt Architecture Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROMPT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SHARED CONSTANTS (langchainConstants.js)                      │
│  ├── SCREENPLAY_GRAMMAR_V1   ✅ AI → Editor contract           │
│  ├── VALID_TAGS_BLOCK        ✅ Tag reference                  │
│  └── JSON_ESCAPE_RULE        ✅ Shared instruction             │
│                                                                 │
│  SCRIPT GENERATION (uses shared grammar)                       │
│  ├── append-page      ✅ 16-20 lines                           │
│  └── next-five-lines  ✅ 5 lines                               │
│                                                                 │
│  IDEATION (templated with tone differentiation)                │
│  └── createIdeationPrompt() → scene, character, location,      │
│                                theme ✅                         │
│                                                                 │
│  BRAINSTORM (templated)                                        │
│  ├── createBrainstormPrompt() → general, story, character,     │
│  │                              location ✅                     │
│  └── brainstorm-title (separate, returns object)               │
│                                                                 │
│  SYSTEM PROMPTS (low redundancy, acceptable)                   │
│  ├── initial                                                   │
│  ├── status                                                    │
│  ├── ideas                                                     │
│  ├── structure                                                 │
│  └── production                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Conclusion

### Completed (P0 + P1)

| Item | Status |
|------|--------|
| Grammar rules in `next-five-lines` | ✅ Done |
| Grammar rules in `append-page` | ✅ Done |
| Context truncation (both chains) | ✅ Done |
| Grammar validation in chains | ✅ Done |
| Function schemas simplified | ✅ Done |
| Shared `SCREENPLAY_GRAMMAR_V1` constant | ✅ Done |
| Templated ideation prompts (4 → 1) | ✅ Done |
| Templated brainstorm prompts (4 → 1) | ✅ Done |
| Tone differentiation for ideation | ✅ Done |

### Remaining Technical Debt (P2)

1. **SYSTEM prompts** — could use standardized instruction style
2. **Fallback instructions** — not specified for edge cases
3. **Length guidance** — missing from conversational prompts

### Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| Prompt definitions | 17 separate | 8 + 9 templated |
| Script generation grammar | Implicit | Explicit (shared constant) |
| Token waste (ideation) | ~400 | ~100 (single template) |
| Token waste (brainstorm) | ~300 | ~75 (single template) |
| Context sent | Full script | Last 20-30 lines |
| Maintenance points | 17 | 10 |

### Architecture After Changes

```
langchainConstants.js
├── SCREENPLAY_GRAMMAR_V1      ← AI → Editor contract
├── VALID_TAGS_BLOCK           ← Tag reference
└── JSON_ESCAPE_RULE           ← Shared instruction

promptRegistry.js
├── createIdeationPrompt()     ← 4 prompts → 1 template
├── createBrainstormPrompt()   ← 4 prompts → 1 template
├── next-five-lines            ← Uses shared grammar
└── append-page                ← Uses shared grammar
```

### Next Steps

1. Monitor grammar validation metrics in production
2. Address P2 items if user feedback indicates need
3. Consider `SCREENPLAY_GRAMMAR_V2` if rules need evolution
