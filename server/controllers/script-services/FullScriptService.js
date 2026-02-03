import scriptModel from '../../models/script.js';
import { ScriptFullChain, FULL_SCRIPT_INTENT } from '../langchain/chains/script/ScriptFullChain.js';
import { normalizeScriptForAppend } from '../langchain/chains/helpers/ScriptNormalization.js';
import { extractChainResponse } from './helpers/ScriptResponseUtils.js';
import { buildScriptContextBundle } from '../script/context-builder.service.js';

export const FULL_SCRIPT_GENERATION_MODE = 'FULL_SCRIPT';

export const generateFullScript = async({ scriptId, userId, prompt, maxAttempts } = {}) => {
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
    includeScriptContext: true,
    allowStructuredExtraction: true
  });

  const chain = new ScriptFullChain();
  const response = await chain.run({
    userId,
    scriptId,
    scriptTitle: contextBundle.scriptTitle,
    scriptDescription: contextBundle.scriptDescription,
    scriptContent,
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
    intent: FULL_SCRIPT_INTENT
  };
};
