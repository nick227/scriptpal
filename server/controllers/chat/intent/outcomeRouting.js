import { INTENT_TYPES } from '../../langchain/constants.js';
import { APPEND_SCRIPT_INTENT } from '../../script-services/AppendPageService.js';
import { CHAT_OUTCOME } from './outcomes.js';

/**
 * Map product outcome to chain registry intent.
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
      return INTENT_TYPES.WRITE_SCENE;
    case CHAT_OUTCOME.WRITE_FROM_SCENES:
      return INTENT_TYPES.WRITE_FROM_SCENES;
    case CHAT_OUTCOME.GENERATE_COLLECTIONS:
      return INTENT_TYPES.GENERATE_COLLECTIONS;
    case CHAT_OUTCOME.REWRITE:
      return INTENT_TYPES.REWRITE;
    case CHAT_OUTCOME.CHAT_CONTROL:
    default:
      return INTENT_TYPES.GENERAL_CONVERSATION;
  }
};

export const shouldRemapResponseToAppend = (outcome) =>
  outcome === CHAT_OUTCOME.WRITE_CONTINUE
  || outcome === CHAT_OUTCOME.WRITE_SCENE
  || outcome === CHAT_OUTCOME.WRITE_FROM_SCENES;

/**
 * API / client intent label (editor routing).
 */
export const resolveResponseIntent = (outcome, intentResult) => {
  switch (outcome) {
    case CHAT_OUTCOME.WRITE_CONTINUE:
    case CHAT_OUTCOME.WRITE_SCENE:
    case CHAT_OUTCOME.WRITE_FROM_SCENES:
      return { ...intentResult, intent: APPEND_SCRIPT_INTENT };
    case CHAT_OUTCOME.GENERATE_COLLECTIONS:
      return { ...intentResult, intent: INTENT_TYPES.GENERATE_COLLECTIONS };
    case CHAT_OUTCOME.REWRITE:
      return { ...intentResult, intent: INTENT_TYPES.REWRITE };
    case CHAT_OUTCOME.DISCUSS_SCENES:
      return { ...intentResult, intent: INTENT_TYPES.DISCUSS_SCENES };
    case CHAT_OUTCOME.DISCUSS_SCRIPT:
      return { ...intentResult, intent: INTENT_TYPES.SCRIPT_REFLECTION };
    default:
      return intentResult;
  }
};
