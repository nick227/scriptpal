import { normalizeScriptForPrompt } from '../langchain/chains/helpers/ScriptNormalization.js';

export const buildScriptInfo = (script, options = {}) => {
  const {
    includeScriptContext = false,
    allowStructuredExtraction = true
  } = options;
  const scriptTitle = script?.title || 'Untitled Script';
  const scriptDescription = script?.description || '';
  const scriptContent = includeScriptContext
    ? normalizeScriptForPrompt(script?.content || '', { allowStructuredExtraction })
    : '';

  return {
    scriptTitle,
    scriptDescription,
    scriptContent
  };
};

export const buildScriptMetadata = (script, options = {}) => {
  const { updatedAtKey = 'updatedAt' } = options;
  const metadata = {
    versionNumber: script?.versionNumber,
    status: script?.status
  };
  metadata[updatedAtKey] = script?.updatedAt || null;
  return metadata;
};

export const buildScriptContextPayload = (script, options = {}) => {
  const {
    includeScriptContext = false,
    allowStructuredExtraction = true,
    updatedAtKey = 'updatedAt'
  } = options;
  const { scriptTitle, scriptDescription, scriptContent } = buildScriptInfo(script, {
    includeScriptContext,
    allowStructuredExtraction
  });
  const scriptMetadata = buildScriptMetadata(script, { updatedAtKey });

  return {
    scriptTitle,
    scriptDescription,
    scriptContent,
    scriptMetadata
  };
};
