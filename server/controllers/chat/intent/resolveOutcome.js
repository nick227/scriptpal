import {
  isAppendPageRequest,
  isNextFiveLinesRequest,
  isFullScriptRequest,
  isGeneralConversation,
  isAttachHistoryRequest
} from './heuristics.js';
import { CHAT_OUTCOME, CONTEXT_PROFILE, EDITOR_OPERATION } from './outcomes.js';

const REWRITE_PATTERN = /\b(rewrite|rephrase|revise|fix|improve|tighten|polish)\b/i;

const WRITE_SCENE_PATTERN = /\b(write|generate|draft|create)\b[\s\S]{0,40}\b(scene|scenes)\b/i;
const SCENE_NUMBER_WRITE_PATTERN = /\b(write|generate|draft)\b[\s\S]{0,20}\bscene\s*\d+/i;

const SCENE_TOPIC_PATTERN = /\b(scene list|scene outline|outline|beats?|beat sheet|my scenes|scene\s*\d+|act\s*\d+|sequence)\b/i;

const DISCUSS_SCRIPT_PATTERN = /\b(opening|structure|tone|pacing|protagonist|ending|theme|dialogue|character arc|story arc|plot hole|does this work|too slow|too fast)\b/i;

const WRITE_CONTINUE_PATTERN = /\b(continue|keep going|next lines|more lines|write more|add more)\b/i;

const buildResolution = ({
  outcome,
  contextProfile,
  attachHistory = false,
  attachScenes = false,
  editorOperation = null
}) => ({
  outcome,
  contextProfile,
  attachHistory,
  attachScenes,
  editorOperation
});

const hasSelection = (context) => {
  const selection = context?.selection;
  if (!selection || typeof selection !== 'object') {
    return false;
  }
  const text = selection.text ?? selection.content ?? '';
  return typeof text === 'string' && text.trim().length > 0;
};

/**
 * Regex-first outcome resolution before context assembly or chain routing.
 */
export const resolveOutcome = (prompt, context = {}) => {
  const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  const attachHistory = Boolean(context.attachHistory) || isAttachHistoryRequest(normalizedPrompt);
  const hasScript = Boolean(context.scriptId);

  if (!hasScript || isGeneralConversation(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.CHAT_CONTROL,
      contextProfile: CONTEXT_PROFILE.MINIMAL,
      attachHistory,
      attachScenes: false,
      editorOperation: null
    });
  }

  if (hasSelection(context) && REWRITE_PATTERN.test(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.REWRITE,
      contextProfile: CONTEXT_PROFILE.SELECTION,
      attachHistory,
      attachScenes: false,
      editorOperation: EDITOR_OPERATION.REPLACE
    });
  }

  if (WRITE_SCENE_PATTERN.test(normalizedPrompt) || SCENE_NUMBER_WRITE_PATTERN.test(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.WRITE_SCENE,
      contextProfile: CONTEXT_PROFILE.SCENES_OUTLINE,
      attachHistory,
      attachScenes: true,
      editorOperation: EDITOR_OPERATION.APPEND
    });
  }

  if (SCENE_TOPIC_PATTERN.test(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.DISCUSS_SCENES,
      contextProfile: CONTEXT_PROFILE.SCENES_OUTLINE,
      attachHistory,
      attachScenes: true,
      editorOperation: null
    });
  }

  if (
    isNextFiveLinesRequest(normalizedPrompt) ||
    isAppendPageRequest(normalizedPrompt) ||
    isFullScriptRequest(normalizedPrompt) ||
    Boolean(context.forceAppend) ||
    Boolean(context.forceFullScript) ||
    WRITE_CONTINUE_PATTERN.test(normalizedPrompt)
  ) {
    return buildResolution({
      outcome: CHAT_OUTCOME.WRITE_CONTINUE,
      contextProfile: CONTEXT_PROFILE.SCRIPT_TAIL,
      attachHistory,
      attachScenes: false,
      editorOperation: EDITOR_OPERATION.APPEND
    });
  }

  if (DISCUSS_SCRIPT_PATTERN.test(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.DISCUSS_SCRIPT,
      contextProfile: CONTEXT_PROFILE.SCRIPT_TAIL,
      attachHistory,
      attachScenes: false,
      editorOperation: null
    });
  }

  return buildResolution({
    outcome: CHAT_OUTCOME.WRITE_CONTINUE,
    contextProfile: CONTEXT_PROFILE.SCRIPT_TAIL,
    attachHistory,
    attachScenes: false,
    editorOperation: EDITOR_OPERATION.APPEND
  });
};
