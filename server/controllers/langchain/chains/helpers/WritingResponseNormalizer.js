import { INTENT_TYPES } from '../../constants.js';
import {
  countScreenplayTaggedLines,
  looksLikeStructuredPayload
} from '../../../../../shared/langchainConstants.js';

export { looksLikeStructuredPayload };

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

  const tagged = countScreenplayTaggedLines(text);
  if (tagged > 0) {
    return tagged;
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

export const stripStructuredScriptOutput = (script) => {
  if (!script || typeof script !== 'string') {
    return '';
  }
  const trimmed = script.trim();
  if (!trimmed || looksLikeStructuredPayload(trimmed)) {
    return '';
  }
  return trimmed;
};

const COLLECTION_FEEDBACK_FALLBACK =
  'I cannot delete or replace items already saved to your lists. Describe how you want the scenes to change and I can suggest a new set.';

/**
 * Chat-only text: short confirmation, never screenplay XML or JSON payloads.
 */
export const sanitizeChatMessage = (message, formattedScript = '') => {
  let msg = typeof message === 'string' ? message.trim() : '';

  if (looksLikeStructuredPayload(msg)) {
    msg = '';
  }

  const script = stripStructuredScriptOutput(formattedScript);

  if (!msg || SCRIPT_TAG_PATTERN.test(msg)) {
    const lineCount = countScriptLines(script);
    if (lineCount > 0) {
      return `Added ${lineCount} line${lineCount === 1 ? '' : 's'} to your script.`;
    }
    return script
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
  const script = stripStructuredScriptOutput(formattedScript);
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
  const safeScript = stripStructuredScriptOutput(script || '');
  let msg = typeof message === 'string' ? message.trim() : '';

  if (looksLikeStructuredPayload(msg)) {
    msg = '';
  }

  if (isWritingIntent(intentOrMode)) {
    return sanitizeChatMessage(msg, safeScript);
  }

  if (!msg) {
    return safeScript ? sanitizeChatMessage(null, safeScript) : null;
  }

  if (msg.length > MAX_CHAT_MESSAGE_LENGTH) {
    return `${msg.slice(0, MAX_CHAT_MESSAGE_LENGTH - 3)}...`;
  }

  return msg;
};

export const rejectNonScreenplayScriptOutput = ({
  message,
  script,
  metadata = {},
  fallbackMessage = 'I could not append that to your script. Ask me to discuss your scenes or describe what to write next.'
}) => {
  const trimmed = typeof script === 'string' ? script.trim() : '';
  if (!trimmed) {
    return null;
  }
  if (looksLikeStructuredPayload(trimmed)) {
    return {
      message: looksLikeStructuredPayload(message) ? fallbackMessage : (message || fallbackMessage),
      script: '',
      metadata: {
        ...metadata,
        scriptRejected: true,
        rejectionReason: 'structured_payload'
      }
    };
  }
  if (countScreenplayTaggedLines(trimmed) < 1) {
    return {
      message: fallbackMessage,
      script: '',
      metadata: {
        ...metadata,
        scriptRejected: true,
        rejectionReason: 'missing_screenplay_tags'
      }
    };
  }
  return null;
};

export const collectionFeedbackChatMessage = () => COLLECTION_FEEDBACK_FALLBACK;
