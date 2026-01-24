import scriptModel from '../../models/script.js';
import { FullScriptChain, FULL_SCRIPT_INTENT } from '../langchain/chains/edit/FullScriptChain.js';
import { ChainHelper } from '../langchain/chains/helpers/ChainHelper.js';

export const FULL_SCRIPT_GENERATION_MODE = 'FULL_SCRIPT';

export const generateFullScript = async({ scriptId, userId, prompt }) => {
  const script = await scriptModel.getScript(scriptId);
  if (!script) {
    const error = new Error('Script not found');
    error.code = 'SCRIPT_NOT_FOUND';
    throw error;
  }

  const rawContent = script.content || '';
  const normalizedContent = ChainHelper.extractTextFromStructuredContent(rawContent);
  const scriptContent = normalizedContent !== null ? normalizedContent : rawContent;
  if (typeof scriptContent !== 'string') {
    const error = new Error('Script content unavailable');
    error.code = 'SCRIPT_CONTENT_UNAVAILABLE';
    throw error;
  }

  const chain = new FullScriptChain();
  const response = await chain.run({
    userId,
    scriptId,
    scriptTitle: script.title || 'Untitled Script',
    scriptContent,
    disableHistory: true,
    chainConfig: {
      shouldGenerateQuestions: false,
      modelConfig: {
        response_format: { type: 'text' }
      }
    }
  }, prompt);

  return {
    responseText: response.response || response,
    scriptTitle: script.title || 'Untitled Script',
    intent: FULL_SCRIPT_INTENT
  };
};
