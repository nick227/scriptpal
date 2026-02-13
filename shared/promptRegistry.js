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
  SERVICE: 'service',
  BRAINSTORM: 'brainstorm',
  ROUTE: 'route'
};

const createPrompt = (definition) => {
  const enabled = definition.enabled ?? true;
  const category = definition.category ?? PROMPT_CATEGORIES.SERVICE;
  return {
    attachScriptContext: false,
    expectsFormattedScript: false,
    scriptMutation: SCRIPT_MUTATION.NONE,
    ...definition,
    enabled,
    category
  };
};

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
  category: PROMPT_CATEGORIES.BRAINSTORM,
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
    label: 'Introduction',
    clientCopy: 'I took a look at your script and can help you get oriented.',
    category: PROMPT_CATEGORIES.SYSTEM,
    route: '/system-prompts',
    enabled: false,
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
    enabled: true,
    attachScriptContext: true,
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
Suggest a list of 5 good story ideas.

Real things that could happen to the characters or the character could do.

Be very brief short fast ideas.

`,
    systemInstruction: `
You are a creative story writer.
- Propose five short actionable things that could happen next.
- Be completely original and off the wall.
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
    enabled: false,
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
    enabled: false,
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
    userPrompt: 'Write the next page (16-20 lines) continuing this script.',
    systemInstruction: `You are a screenplay continuation engine.

OUTPUT FORMAT
Return valid JSON only:
{
  "lines": [
    { "tag": "<tag>", "text": "<line text>" }
  ],
  "assistantResponse": "<under 40 words>"
}

LINES RULES
- Provide 16-20 objects in the lines array, one per screenplay beat.
- Each object must include a tag from the valid set (${VALID_TAGS_BLOCK}) and a non-empty text value without nested XML.
- Keep each tag/text focused on one beat; do not bundle multiple actions in one object.
- ${SCREENPLAY_GRAMMAR_V1}

LINE COUNTING
- The lines array must contain 16-20 entries.
- <speaker> + <dialog> count as two separate entries even if they are adjacent.

EXAMPLE
{
  "lines": [
    { "tag": "<action>", "text": "The door creaks open. Nick peers inside." },
    { "tag": "<speaker>", "text": "NICK" },
    { "tag": "<dialog>", "text": "Hello?" }
  ],
  "assistantResponse": "Nick eases the tension with a brief question."
}

RULES
- Continue naturally from the last line.
- Never repeat content from context.
- Match the established tone and pacing.
- Push the story meaningfully forward with each line.
- Use brief efficient language.
- It is better to add too much action.
- Avoid much description be word efficient.
- Never say how a character is feeling; show it through action and dialogue.
- You are a sparkplug drive the momentum with each line.
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
{
  "lines": [
    { "tag": "<tag>", "text": "<line text>" }
  ],
  "assistantResponse": "<under 40 words>"
}

LINES RULES
- Provide exactly 5 objects in the lines array.
- Each object must include a valid tag (${VALID_TAGS_BLOCK}) and a non-empty text string; avoid repeating existing lines.
- Keep each entry focused on one beat; do not combine multiple tags within a single object.
- ${SCREENPLAY_GRAMMAR_V1}

LINE COUNTING
- Each object counts as one line; deliver precisely five entries.

EXAMPLE
Context ends:
<speaker>NICK</speaker>
<dialog>What happened?</dialog>

Correct 5-line output:
{
  "lines": [
    { "tag": "<action>", "text": "Sarah looks away, composing herself." },
    { "tag": "<speaker>", "text": "SARAH" },
    { "tag": "<dialog>", "text": "It's complicated." },
    { "tag": "<speaker>", "text": "NICK" },
    { "tag": "<dialog>", "text": "Try me." }
  ],
  "assistantResponse": "Sarah reluctantly admits there is far more to tell."
}

RULES
- Continue from the last line naturally.
- Never repeat content from context.
- Match the tone and pacing.
- BE ORIGINAL! Push the story forward with each line.
- Use brief, efficient language, avoid descriptive phrases.
- Show feelings through action and dialogue; avoid stating emotions directly.
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
    enabled: false,
    intent: INTENT_TYPES.SCENE_IDEA
  }),
  createIdeationPrompt('character', {
    id: 'character-idea',
    label: 'Character Idea',
    clientCopy: 'Generate a character title and description.',
    route: '/script/:scriptId/characters/ai/character-idea',
    enabled: false,
    intent: INTENT_TYPES.CHARACTER_IDEA
  }),
  createIdeationPrompt('location', {
    id: 'location-idea',
    label: 'Location Idea',
    clientCopy: 'Generate a location title and description.',
    route: '/script/:scriptId/locations/ai/location-idea',
    enabled: false,
    intent: INTENT_TYPES.LOCATION_IDEA
  }),
  createIdeationPrompt('theme', {
    id: 'theme-idea',
    label: 'Theme Idea',
    enabled: false,
    clientCopy: 'Generate a theme title and description.',
    route: '/script/:scriptId/themes/ai/theme-idea',
    intent: INTENT_TYPES.THEME_IDEA
  }),
  createPrompt({
    id: 'outline-idea',
    label: 'Outline Idea',
    clientCopy: 'Generate an outline title and items.',
    category: PROMPT_CATEGORIES.SERVICE,
    route: '/script/:scriptId/outlines/ai/outline-idea',
    enabled: false,
    intent: INTENT_TYPES.OUTLINE_IDEA,
    userPrompt: `Generate an outline idea using:
- Script title, description, and full script text (below)
- If the user provided a draft outline (title and/or items in the Add Outline modal), refine and extend it to fit the script
- Otherwise, create a new outline from scratch`,
    systemInstruction: `You are an outline ideation engine.

Use the script title, description, and full script text to generate an outline. If the user provided a draft (title and/or items in the Add Outline modal), refine and extend it; otherwise create from scratch.

OUTPUT FORMAT
Return valid JSON only: { "title": "Optional title", "items": ["Opening image", "Inciting incident", "Midpoint reversal", "Climax"] }

RULES
- Title: short, specific (3-6 words)
- items: array of strings, each a beat or outline point (3-8 items typical)
- Each item: concise, actionable, screenplay/story beat oriented
- No extra keys, no commentary outside JSON
- ${JSON_ESCAPE_RULE}`
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
    enabled: false,
    userPrompt: 'Generate one concise title for the brainstorming board.',
    systemInstruction: `You are a title generator.

OUTPUT FORMAT
Return valid JSON only: { "title": "..." }

RULES
- Title: short, specific, evocative (2-5 words)
- No punctuation-heavy titles
- No commentary outside JSON`
  }),
  // ---------------------------------
  // ROUTE PROMPTS (quick chat actions)
  // ---------------------------------
  createPrompt({
    id: 'route-script-conversation',
    label: 'Script Chat',
    clientCopy: 'Ask the assistant to continue the script with new lines.',
    enabled: false,
    category: PROMPT_CATEGORIES.ROUTE,
    intent: INTENT_TYPES.SCRIPT_CONVERSATION,
    userPrompt: 'Continue the current script and add the next set of lines in-story without rewriting what exists.'
  }),
  createPrompt({
    id: 'route-script-reflection',
    label: 'Script Reflection',
    enabled: false,
    clientCopy: 'Discuss themes, characters, and choices without writing new lines.',
    category: PROMPT_CATEGORIES.ROUTE,
    intent: INTENT_TYPES.SCRIPT_REFLECTION,
    userPrompt: 'Reflect on the current script—its tone, characters, and pacing—without producing new formatted lines.'
  }),
  createPrompt({
    id: 'route-next-five-lines',
    label: 'Next Five Lines',
    clientCopy: 'Request the assistant to write the next five formatted lines and explain the fit.',
    category: PROMPT_CATEGORIES.ROUTE,
    intent: INTENT_TYPES.NEXT_FIVE_LINES,
    userPrompt: 'Write the next five formatted lines for the script.'
  }),
  createPrompt({
    id: 'route-general-chat',
    label: 'General Conversation',
    clientCopy: 'Talk about anything else without editing the script.',
    category: PROMPT_CATEGORIES.ROUTE,
    intent: INTENT_TYPES.GENERAL_CONVERSATION,
    enabled: false,
    userPrompt: 'Let us talk about the story ideas or craft without changing the script.'
  })
];

export const getPromptById = (id) => PROMPT_REGISTRY.find(prompt => prompt.id === id);

const filterByCategory = (category) => PROMPT_REGISTRY.filter(
  prompt => prompt.enabled && prompt.category === category
);

export const SYSTEM_PROMPTS = filterByCategory(PROMPT_CATEGORIES.SYSTEM);
export const SYSTEM_PROMPTS_MAP = SYSTEM_PROMPTS.reduce((acc, prompt) => {
  acc[prompt.id] = prompt;
  return acc;
}, {});
export const ROUTE_PROMPTS = filterByCategory(PROMPT_CATEGORIES.ROUTE);
export const BRAINSTORM_PROMPTS = filterByCategory(PROMPT_CATEGORIES.BRAINSTORM);
