import {
  INTENT_TYPES,
  VALID_FORMAT_VALUES,
  SCRIPT_MUTATION,
  VALID_TAGS_BLOCK,
  SCREENPLAY_GRAMMAR_V1,
  JSON_ESCAPE_RULE
} from './langchainConstants.js';

export const PROMPT_CATEGORIES = {
  SYSTEM: 'system',
  SERVICE: 'service'
};

const createPrompt = (definition) => ({
  attachScriptContext: false,
  expectsFormattedScript: false,
  scriptMutation: SCRIPT_MUTATION.NONE,
  ...definition
});

const VALID_TAGS = VALID_FORMAT_VALUES.join(', ');

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ideation tone by item type - prevents "why do scene + theme feel the same?"
 */
const IDEATION_TONE = {
  scene: 'story structure, progression, and dramatic purpose',
  character: 'motivation, conflict, personality, and arc',
  location: 'atmosphere, constraints, visual identity, and mood',
  theme: 'underlying meaning, emotional resonance, and thematic arc'
};

/**
 * Template for item ideation prompts (scene, character, location, theme)
 */
const createIdeationPrompt = (itemType, extras = {}) => createPrompt({
  category: PROMPT_CATEGORIES.SERVICE,
  attachScriptContext: true,
  userPrompt: `Generate a ${itemType} idea based on the script context.`,
  systemInstruction: `You are a ${itemType} ideation engine.

OUTPUT FORMAT
Return valid JSON only: { "title": "...", "description": "..." }

FOCUS AREA
Consider: ${IDEATION_TONE[itemType] || 'relevance to the script'}

RULES
- Title: short, specific, evocative (3-6 words)
- Description: 2-4 sentences, aligned with script context
- No extra keys, no commentary outside JSON
- ${JSON_ESCAPE_RULE}`,
  ...extras
});

/**
 * Template for brainstorm prompts
 */
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

export const PROMPT_REGISTRY = [
  // ---------------------------------
  // PROMPT_REGISTRY
  // welcome
  createPrompt({
    id: 'initial',
    label: 'Welcome / Orientation',
    clientCopy: 'I took a look at your script and can help you get oriented.',
    category: PROMPT_CATEGORIES.SYSTEM,
    route: '/system-prompts',
    intent: INTENT_TYPES.SCRIPT_CONVERSATION,
    userPrompt: `
SYSTEM WELCOME.
Greet the user, briefly reflect what is present so far (title, length, or emptiness),
and explain how you can help. Do not ask questions or request input.
`,
    systemInstruction: `
You are a calm, helpful script-writing assistant.
- Greet the user briefly.
- Reflect the current script state if available (title, empty script, early draft, etc.).
- Explain what kinds of help you can offer next.
- Do NOT ask the user questions.
- Keep the response short and welcoming.
`,
  }),
  // ---------------------------------
  // PROMPT_REGISTRY
  // status
  createPrompt({
    id: 'status',
    label: 'Status Check',
    clientCopy: 'I can give you a quick status check and suggest what to focus on next.',
    category: PROMPT_CATEGORIES.SYSTEM,
    route: '/system-prompts',
    intent: INTENT_TYPES.SCRIPT_CONVERSATION,
    userPrompt: `
SYSTEM STATUS CHECK.
Review the current script and summarize where things stand.
Then suggest one clear next focus area.
`,
    systemInstruction: `
You are an observant assistant providing a status report.
- Summarize the current state of the script (scope, progress, strengths).
- Do NOT propose rewrites or new ideas.
- Suggest exactly one next focus area (e.g. continue draft, clarify character, finish section).
- Keep the tone factual and concise.
`,
  }),
  // ---------------------------------
  // PROMPT_REGISTRY
  // ideas
  createPrompt({
    id: 'ideas',
    label: 'Ideas',
    clientCopy: 'Want a creative nudge to keep momentum going?',
    category: PROMPT_CATEGORIES.SYSTEM,
    route: '/system-prompts',
    intent: INTENT_TYPES.SCRIPT_CONVERSATION,
    attachScriptContext: true,
    userPrompt: `
SYSTEM IDEA NUDGE.
Analyze the script and propose new directions that could increase momentum.
Avoid repeating previous ideas.
`,
    systemInstruction: `
You are a creative collaborator.
- Propose exactly two idea nudges.
- Each idea should be meaningfully different (structure, character, or tone).
- Base ideas on what is already present or missing.
- Do NOT summarize the script.
- Do NOT rewrite scenes or dialogue.
`,
  }),
  // ---------------------------------
  // PROMPT_REGISTRY
  // structure
  createPrompt({
    id: 'structure',
    label: 'Structure & Pacing',
    clientCopy: 'I can do a structural and pacing check.',
    attachScriptContext: true,
    category: PROMPT_CATEGORIES.SYSTEM,
    route: '/system-prompts',
    intent: INTENT_TYPES.SCRIPT_CONVERSATION,
    userPrompt: `
SYSTEM STRUCTURE REVIEW.
Analyze the script's structure and pacing.
Identify imbalances and suggest targeted adjustments.
`,
    systemInstruction: `
You are a structure-focused script editor.
- Focus only on pacing, act/sequence balance, and progression.
- Identify concrete structural issues.
- Suggest 2-3 specific adjustments (reorder, expand, compress, relocate).
- Do NOT generate new story ideas.
- Do NOT rewrite content.
`,
  }),
  // ---------------------------------
  // PROMPT_REGISTRY
  // production
  createPrompt({
    id: 'production',
    label: 'Production Readiness',
    clientCopy: 'I can surface early production considerations.',
    category: PROMPT_CATEGORIES.SYSTEM,
    attachScriptContext: true,
    route: '/system-prompts',
    intent: INTENT_TYPES.SCRIPT_CONVERSATION,
    userPrompt: `
SYSTEM PRODUCTION REVIEW.
Scan the script for production implications.
`,
    systemInstruction: `
You are a production-minded assistant.
- Identify practical production considerations if present (locations, props, stunts, complexity).
- If details are missing, say so explicitly.
- Suggest what information would be needed next for production planning.
- Do NOT invent logistics.
- Keep notes concise and actionable.
`,
  }),
  // ---------------------------------
  // PROMPT_REGISTRY
  // append-page (uses shared grammar contract)
  createPrompt({
    id: 'append-page',
    label: 'Next Page',
    clientCopy: 'I can add the next page of formatted script lines.',
    category: PROMPT_CATEGORIES.SERVICE,
    route: '/script/:scriptId/append-page',
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
<speaker> + <dialog> = 2 lines (not 1 exchange)

EXAMPLE
<action>The door creaks open. Nick peers inside.</action>
<speaker>NICK</speaker>
<dialog>Hello?</dialog>
<action>Silence. Then footsteps from above.</action>
<speaker>SARAH</speaker>
<directions>(whispering)</directions>
<dialog>Over here. Quickly.</dialog>
<action>Nick crosses to Sarah, crouching behind the counter.</action>
<speaker>NICK</speaker>
<dialog>What's going on?</dialog>
<speaker>SARAH</speaker>
<dialog>They found us.</dialog>

RULES
- Continue naturally from the last line
- Never repeat content from context
- Match the established tone and pacing
- ${JSON_ESCAPE_RULE}`,
  }),
  // ---------------------------------
  // PROMPT_REGISTRY
  // next-five-lines (uses shared grammar contract)
  createPrompt({
    id: 'next-five-lines',
    label: 'Next Five Lines',
    clientCopy: 'Need the next five formatted script lines and a short rationale?',
    category: PROMPT_CATEGORIES.SERVICE,
    route: '/script/:scriptId/next-lines',
    intent: INTENT_TYPES.NEXT_FIVE_LINES,
    attachScriptContext: true,
    expectsFormattedScript: true,
    scriptMutation: SCRIPT_MUTATION.APPEND,
    userPrompt: 'Write the next 5 lines continuing this script.',
    systemInstruction: `You are a screenplay continuation engine.

OUTPUT FORMAT
Return valid JSON only:
{ "formattedScript": "<5 lines>", "assistantResponse": "<under 40 words>" }

${VALID_TAGS_BLOCK}

${SCREENPLAY_GRAMMAR_V1}

LINE COUNTING
Each XML tag = 1 line. You must output EXACTLY 5 tags.
<speaker> + <dialog> = 2 lines (not 1 exchange)

EXAMPLE
Context ends:
<speaker>NICK</speaker>
<dialog>What happened?</dialog>

Correct 5-line output:
<action>Sarah looks away, composing herself.</action>
<speaker>SARAH</speaker>
<dialog>It's complicated.</dialog>
<speaker>NICK</speaker>
<dialog>Try me.</dialog>

RULES
- Continue from the last line naturally
- Never repeat content from context
- Match the tone and pacing
- ${JSON_ESCAPE_RULE}`,
  }),
  // ---------------------------------
  // IDEATION PROMPTS (templated)
  // ---------------------------------
  createIdeationPrompt('scene', {
    id: 'scene-idea',
    label: 'Scene Idea',
    clientCopy: 'Generate a scene title and description.',
    route: '/script/:scriptId/scenes/ai/scene-idea',
    intent: INTENT_TYPES.SCENE_IDEA
  }),
  createIdeationPrompt('character', {
    id: 'character-idea',
    label: 'Character Idea',
    clientCopy: 'Generate a character title and description.',
    route: '/script/:scriptId/characters/ai/character-idea',
    intent: INTENT_TYPES.CHARACTER_IDEA
  }),
  createIdeationPrompt('location', {
    id: 'location-idea',
    label: 'Location Idea',
    clientCopy: 'Generate a location title and description.',
    route: '/script/:scriptId/locations/ai/location-idea',
    intent: INTENT_TYPES.LOCATION_IDEA
  }),
  createIdeationPrompt('theme', {
    id: 'theme-idea',
    label: 'Theme Idea',
    clientCopy: 'Generate a theme title and description.',
    route: '/script/:scriptId/themes/ai/theme-idea',
    intent: INTENT_TYPES.THEME_IDEA
  }),
  // ---------------------------------
  // BRAINSTORM PROMPTS (templated)
  // ---------------------------------
  createBrainstormPrompt('word associations', '6-10 (target 8)', {
    id: 'brainstorm-general',
    label: 'Brainstorm · General',
    clientCopy: 'Generate word associations for the seed concepts.',
    route: '/brainstorm/boards/:boardId/ai/general',
    intent: INTENT_TYPES.BRAINSTORM_GENERAL
  }),
  createBrainstormPrompt('story ideas', '1-3 (target 2)', {
    id: 'brainstorm-story',
    label: 'Brainstorm · Story',
    clientCopy: 'Generate story ideas for the seed concepts.',
    route: '/brainstorm/boards/:boardId/ai/story',
    intent: INTENT_TYPES.BRAINSTORM_STORY
  }),
  createBrainstormPrompt('character ideas', '2-4 (target 3)', {
    id: 'brainstorm-character',
    label: 'Brainstorm · Character',
    clientCopy: 'Generate character ideas for the seed concepts.',
    route: '/brainstorm/boards/:boardId/ai/character',
    intent: INTENT_TYPES.BRAINSTORM_CHARACTER
  }),
  createBrainstormPrompt('location ideas', '2-4 (target 3)', {
    id: 'brainstorm-location',
    label: 'Brainstorm · Location',
    clientCopy: 'Generate location ideas for the seed concepts.',
    route: '/brainstorm/boards/:boardId/ai/location',
    intent: INTENT_TYPES.BRAINSTORM_LOCATION
  }),
  // brainstorm-title returns JSON object, not array (kept separate)
  createPrompt({
    id: 'brainstorm-title',
    label: 'Brainstorm · Title',
    clientCopy: 'Generate a concise title for this board.',
    category: PROMPT_CATEGORIES.SERVICE,
    route: '/brainstorm/boards/:boardId/ai/title',
    intent: INTENT_TYPES.BRAINSTORM_TITLE,
    userPrompt: 'Generate one concise title for the brainstorming board.',
    systemInstruction: `You are a title generator.

OUTPUT FORMAT
Return valid JSON only: { "title": "..." }

RULES
- Title: short, specific, evocative (2-5 words)
- No punctuation-heavy titles
- No commentary outside JSON`
  })
];

export const getPromptById = (id) => PROMPT_REGISTRY.find(prompt => prompt.id === id);
