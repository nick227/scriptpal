import { normalizeScriptForPrompt } from './ChainInputUtils.js';

export { normalizeScriptForPrompt };

export const normalizeScriptForAppend = (scriptContent) => (
  normalizeScriptForPrompt(scriptContent, { allowStructuredExtraction: true })
);
