import { INTENT_TYPES } from '../../constants.js';

export const SCRIPT_TAG_PATTERN = /<(header|action|speaker|dialog|directions|chapter-break)\b/i;
export const MAX_CHAT_MESSAGE_LENGTH = 240;

/** Keep in sync with AppendPageService.APPEND_SCRIPT_INTENT — not imported to avoid ESM cycle. */
const APPEND_SCRIPT_INTENT = 'APPEND_SCRIPT';

const WRITING_INTENTS = new Set([
  INTENT_TYPES.SCRIPT_CONVERSATION,
  INTENT_TYPES.NEXT_FIVE_LINES,
  INTENT_TYPES.WRITE_SCENE,
  INTENT_TYPES.WRITE_FROM_SCENES,
  INTENT_TYPES.REWRITE,
  APPEND_SCRIPT_INTENT,
  'SCRIPT_APPEND_PAGE',
  'SCRIPT_FULL_SCRIPT'
]);

export const isWritingIntent = (intentOrMode) => {
  if (!intentOrMode || typeof intentOrMode !== 'string') {
    return false;
  }
  return WRITING_INTENTS.has(intentOrMode);
};

const countScriptLines = (text) => {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
  const matches = text.match(tagPattern);
  if (matches && matches.length > 0) {
    return matches.length;
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .length;
};

/**
 * Chat-only text: short confirmation, never screenplay XML.
 */
export const sanitizeChatMessage = (message, formattedScript = '') => {
  let msg = typeof message === 'string' ? message.trim() : '';

  if (!msg || SCRIPT_TAG_PATTERN.test(msg)) {
    const lineCount = countScriptLines(formattedScript);
    if (lineCount > 0) {
      return `Added ${lineCount} line${lineCount === 1 ? '' : 's'} to your script.`;
    }
    return formattedScript && formattedScript.trim()
      ? 'Updated your script.'
      : 'Done.';
  }

  if (msg.length > MAX_CHAT_MESSAGE_LENGTH) {
    return `${msg.slice(0, MAX_CHAT_MESSAGE_LENGTH - 3)}...`;
  }

  return msg;
};

/**
 * Map model output to v2 canonical shape for writing chains.
 */
export const normalizeWritingResponse = ({
  assistantMessage = null,
  formattedScript = '',
  metadata = {},
  type = null
}) => {
  const script = typeof formattedScript === 'string' ? formattedScript.trim() : '';
  const message = sanitizeChatMessage(assistantMessage, script);

  const result = {
    message,
    script,
    metadata: { ...metadata }
  };

  if (type) {
    result.type = type;
  }

  return result;
};

export const sanitizeChatMessageForResponse = (message, script, intentOrMode) => {
  if (!isWritingIntent(intentOrMode)) {
    return message;
  }
  return sanitizeChatMessage(message, script || '');
};
