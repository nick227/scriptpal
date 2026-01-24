import scriptModel from '../../models/script.js';
import { AppendPageChain, APPEND_PAGE_INTENT } from '../langchain/chains/edit/AppendPageChain.js';
import { ChainHelper } from '../langchain/chains/helpers/ChainHelper.js';

export { APPEND_PAGE_INTENT };
export const APPEND_SCRIPT_INTENT = 'APPEND_SCRIPT';

export const generateAppendPage = async({ scriptId, userId, prompt }) => {
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

  const chain = new AppendPageChain();
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
    intent: APPEND_PAGE_INTENT
  };
};
