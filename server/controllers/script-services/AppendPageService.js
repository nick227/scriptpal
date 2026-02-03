import scriptModel from '../../models/script.js';
import { ScriptPageAppendChain, APPEND_PAGE_INTENT } from '../langchain/chains/script/ScriptPageAppendChain.js';
import { normalizeScriptForAppend } from '../langchain/chains/helpers/ScriptNormalization.js';
import { getPromptById } from '../../../shared/promptRegistry.js';
import { extractChainResponse } from './helpers/ScriptResponseUtils.js';
import { buildScriptContextBundle } from '../script/context-builder.service.js';

export { APPEND_PAGE_INTENT };
export const APPEND_SCRIPT_INTENT = 'APPEND_SCRIPT';

const APPEND_PAGE_PROMPT = getPromptById('append-page');

if (!APPEND_PAGE_PROMPT) {
  throw new Error('Append page prompt definition is missing from the registry');
}

export const generateAppendPage = async({ scriptId, userId, prompt, maxAttempts } = {}) => {
  const script = await scriptModel.getScript(scriptId);
  if (!script) {
    const error = new Error('Script not found');
    error.code = 'SCRIPT_NOT_FOUND';
    throw error;
  }

  const scriptContent = normalizeScriptForAppend(script.content || '');
  if (typeof scriptContent !== 'string') {
    const error = new Error('Script content unavailable');
    error.code = 'SCRIPT_CONTENT_UNAVAILABLE';
    throw error;
  }

  const contextBundle = await buildScriptContextBundle({
    scriptId,
    script,
    includeScriptContext: APPEND_PAGE_PROMPT.attachScriptContext ?? true,
    allowStructuredExtraction: true
  });

  const chain = new ScriptPageAppendChain();
  const response = await chain.run({
    userId,
    scriptId,
    scriptTitle: contextBundle.scriptTitle,
    scriptDescription: contextBundle.scriptDescription,
    scriptContent,
    attachScriptContext: APPEND_PAGE_PROMPT.attachScriptContext ?? true,
    scriptCollections: contextBundle.scriptCollections,
    maxAttempts,
    disableHistory: true,
    chainConfig: {
      shouldGenerateQuestions: false
    }
  }, prompt);

  const { responseText, formattedScript, assistantResponse } = extractChainResponse(response);

  return {
    responseText,
    assistantResponse,
    formattedScript,
    scriptTitle: script.title || 'Untitled Script',
    intent: APPEND_PAGE_INTENT
  };
};
