import { PROMPT_REGISTRY, PROMPT_CATEGORIES } from './promptRegistry.js';

export const SYSTEM_PROMPTS = PROMPT_REGISTRY.filter(prompt => prompt.category === PROMPT_CATEGORIES.SYSTEM);

export const SYSTEM_PROMPTS_MAP = SYSTEM_PROMPTS.reduce((acc, prompt) => {
  acc[prompt.id] = prompt;
  return acc;
}, {});
