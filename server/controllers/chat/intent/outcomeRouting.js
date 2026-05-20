import { INTENT_TYPES } from '../../langchain/constants.js';
import { CHAT_OUTCOME } from './outcomes.js';

/**
 * Map product outcome to chain registry intent (P3a: no WRITE_SCENE / REWRITE chains yet).
 */
export const outcomeToIntent = (outcome) => {
  switch (outcome) {
    case CHAT_OUTCOME.WRITE_CONTINUE:
      return INTENT_TYPES.SCRIPT_CONVERSATION;
    case CHAT_OUTCOME.DISCUSS_SCRIPT:
      return INTENT_TYPES.SCRIPT_REFLECTION;
    case CHAT_OUTCOME.DISCUSS_SCENES:
      return INTENT_TYPES.DISCUSS_SCENES;
    case CHAT_OUTCOME.WRITE_SCENE:
      return INTENT_TYPES.DISCUSS_SCENES;
    case CHAT_OUTCOME.REWRITE:
      return INTENT_TYPES.SCRIPT_REFLECTION;
    case CHAT_OUTCOME.CHAT_CONTROL:
    default:
      return INTENT_TYPES.GENERAL_CONVERSATION;
  }
};

export const shouldRemapResponseToAppend = (outcome) => outcome === CHAT_OUTCOME.WRITE_CONTINUE;
