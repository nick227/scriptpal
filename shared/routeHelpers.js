import { PROMPT_REGISTRY, PROMPT_CATEGORIES } from './promptRegistry.js';

export const ROUTE_HELPERS = PROMPT_REGISTRY
    .filter(prompt => prompt.enabled && prompt.category === PROMPT_CATEGORIES.ROUTE)
    .map(prompt => ({
        id: prompt.id,
        label: prompt.label,
        description: prompt.clientCopy,
        intent: prompt.intent,
        type: 'route',
        prompt: prompt.userPrompt || prompt.clientCopy || ''
    }));
