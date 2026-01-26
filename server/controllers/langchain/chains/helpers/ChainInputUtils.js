import { INTENT_TYPES } from '../../constants.js';

const extractTextFromStructuredContent = (content) => {
  if (typeof content !== 'string') {
    return null;
  }

  const trimmed = content.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    const lines = Array.isArray(parsed?.lines) ? parsed.lines : Array.isArray(parsed) ? parsed : null;
    if (!lines) {
      return null;
    }

    return lines
      .map(line => {
        const contentText = typeof line?.content === 'string'
          ? line.content
          : typeof line?.text === 'string'
            ? line.text
            : '';
        const format = typeof line?.format === 'string'
          ? line.format
          : typeof line?.tag === 'string'
            ? line.tag
            : null;

        if (!format) {
          return contentText;
        }

        return `<${format}>${contentText}</${format}>`;
      })
      .join('\n');
  } catch (error) {
    return null;
  }
};

export const normalizeScriptForPrompt = (scriptContent, options = {}) => {
  if (typeof scriptContent !== 'string') {
    return '';
  }

  const { allowStructuredExtraction = true } = options;
  if (!allowStructuredExtraction) {
    return scriptContent;
  }

  const structured = extractTextFromStructuredContent(scriptContent);
  return structured !== null ? structured : scriptContent;
};

export const preprocessScript = (scriptContent, options = {}) => {
  const defaults = {
    includeTitle: false,
    includeElements: false,
    elementType: null
  };
  const config = { ...defaults, ...options };

  if (typeof scriptContent === 'string') {
    const structuredText = extractTextFromStructuredContent(scriptContent);
    const base = {
      content: structuredText !== null ? structuredText : scriptContent
    };

    if (config.includeTitle) {
      base.title = 'Untitled Script';
      base.status = 'Draft';
      base.versionNumber = '1.0';
    }

    if (config.includeElements) {
      base.elements = {
        [config.elementType]: []
      };
    }

    return base;
  }

  if (!scriptContent) {
    const base = {
      content: ''
    };

    if (config.includeTitle) {
      base.title = 'Untitled Script';
      base.status = 'Draft';
      base.versionNumber = '1.0';
    }

    if (config.includeElements) {
      base.elements = {
        [config.elementType]: []
      };
    }

    return base;
  }

  const structuredText = typeof scriptContent.content === 'string'
    ? extractTextFromStructuredContent(scriptContent.content)
    : null;
  const base = {
    content: structuredText !== null ? structuredText : scriptContent.content || ''
  };

  if (config.includeTitle) {
    base.title = scriptContent.title || 'Untitled Script';
    base.status = scriptContent.status || 'Draft';
    base.versionNumber = scriptContent.versionNumber || '1.0';
  }

  if (config.includeElements) {
    base.elements = scriptContent.elements || {
      [config.elementType]: []
    };
  }

  return base;
};

export const validateContent = (scriptContent) => {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return false;
  }
  return scriptContent.trim().length >= 10;
};

export const getErrorResponse = (message, type = 'error_response') => ({
  response: message,
  type
});

export const extractContext = (context, defaults = {}) => ({
  scriptId: context.scriptId || defaults.scriptId || null,
  prompt: context.prompt || defaults.prompt || null,
  target: context.target || defaults.target || null
});

export const handlePromptFormatting = async(promptManager, templateName, data, fallbackPrompt) => {
  try {
    return await promptManager.formatPrompt(templateName, data);
  } catch (err) {
    console.error('Error formatting prompt:', err);
    return fallbackPrompt;
  }
};

export const getDefaultQuestions = () => ([{
  text: 'Continue developing the current script',
  intent: INTENT_TYPES.SCRIPT_CONVERSATION
}, {
  text: 'Switch to a general conversational topic',
  intent: INTENT_TYPES.GENERAL_CONVERSATION
}]);
