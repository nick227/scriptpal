import {
  isAppendPageRequest,
  isNextFiveLinesRequest,
  isFullScriptRequest,
  isGeneralConversation,
  isAttachHistoryRequest,
  isWriteFromScenesRequest,
  isWriteSceneScreenplayRequest,
  isDiscussScenesRequest,
  resolveGenerateCollectionTypes,
  isAttachEntityContextRequest,
  isExtractEntitiesFromScriptRequest,
  isPrimaryGenerateCollectionsRequest
} from './heuristics.js';
import { CHAT_OUTCOME, CONTEXT_PROFILE, EDITOR_OPERATION } from './outcomes.js';

const REWRITE_PATTERN = /\b(rewrite|rephrase|revise|fix|improve|tighten|polish)\b/i;

const SCENE_TOPIC_PATTERN = /\b(scene list|scene outline|outline|beats?|beat sheet|my scenes|scene\s*\d+|act\s*\d+|sequence)\b/i;

const DISCUSS_SCRIPT_PATTERN = /\b(opening|structure|tone|pacing|protagonist|ending|theme|dialogue|character arc|story arc|plot hole|does this work|too slow|too fast)\b/i;

const WRITE_CONTINUE_PATTERN = /\b(continue|keep going|next lines|more lines|write more|add more)\b/i;

const buildResolution = ({
  outcome,
  contextProfile,
  attachHistory = false,
  attachScenes = false,
  attachEntityContext = false,
  generateCollections = [],
  editorOperation = null
}) => ({
  outcome,
  contextProfile,
  attachHistory,
  attachScenes,
  attachEntityContext,
  generateCollections,
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

const resolveContextProfile = ({
  attachEntityContext,
  attachScenes,
  extractFromScript,
  defaultProfile
}) => {
  if (attachEntityContext) {
    return CONTEXT_PROFILE.ENTITY_OUTLINE;
  }
  if (extractFromScript) {
    return CONTEXT_PROFILE.SCRIPT_TAIL;
  }
  if (attachScenes) {
    return CONTEXT_PROFILE.SCENES_OUTLINE;
  }
  return defaultProfile;
};

/**
 * Regex-first outcome resolution before context assembly or chain routing.
 */
export const resolveOutcome = (prompt, context = {}) => {
  const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  const attachHistory = Boolean(context.attachHistory) || isAttachHistoryRequest(normalizedPrompt);
  const hasScript = Boolean(context.scriptId);
  const generateCollections = [
    ...new Set([
      ...resolveGenerateCollectionTypes(normalizedPrompt),
      ...(Array.isArray(context.generateCollections) ? context.generateCollections : [])
    ])
  ];
  const attachEntityContext = Boolean(context.attachEntityContext)
    || isAttachEntityContextRequest(normalizedPrompt);
  const extractFromScript = isExtractEntitiesFromScriptRequest(normalizedPrompt);

  if (!hasScript || isGeneralConversation(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.CHAT_CONTROL,
      contextProfile: CONTEXT_PROFILE.MINIMAL,
      attachHistory,
      attachScenes: false,
      attachEntityContext: false,
      generateCollections: [],
      editorOperation: null
    });
  }

  if (hasSelection(context) && REWRITE_PATTERN.test(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.REWRITE,
      contextProfile: CONTEXT_PROFILE.SELECTION,
      attachHistory,
      attachScenes: false,
      attachEntityContext,
      generateCollections,
      editorOperation: EDITOR_OPERATION.REPLACE
    });
  }

  if (isWriteSceneScreenplayRequest(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.WRITE_SCENE,
      contextProfile: resolveContextProfile({
        attachEntityContext,
        attachScenes: true,
        extractFromScript,
        defaultProfile: CONTEXT_PROFILE.SCENES_OUTLINE
      }),
      attachHistory,
      attachScenes: true,
      attachEntityContext,
      generateCollections,
      editorOperation: EDITOR_OPERATION.APPEND
    });
  }

  if (Boolean(context.generateFromScenes) || isWriteFromScenesRequest(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.WRITE_FROM_SCENES,
      contextProfile: CONTEXT_PROFILE.SCENES_OUTLINE,
      attachHistory,
      attachScenes: true,
      attachEntityContext,
      generateCollections,
      editorOperation: EDITOR_OPERATION.APPEND
    });
  }

  if (isDiscussScenesRequest(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.DISCUSS_SCENES,
      contextProfile: CONTEXT_PROFILE.SCENES_OUTLINE,
      attachHistory,
      attachScenes: true,
      attachEntityContext: false,
      generateCollections: [],
      editorOperation: null
    });
  }

  if (isPrimaryGenerateCollectionsRequest(normalizedPrompt, generateCollections)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.GENERATE_COLLECTIONS,
      contextProfile: resolveContextProfile({
        attachEntityContext,
        attachScenes: false,
        extractFromScript,
        defaultProfile: CONTEXT_PROFILE.MINIMAL
      }),
      attachHistory,
      attachScenes: false,
      attachEntityContext,
      generateCollections,
      editorOperation: null
    });
  }

  if (attachEntityContext && !generateCollections.length && SCENE_TOPIC_PATTERN.test(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.DISCUSS_SCENES,
      contextProfile: CONTEXT_PROFILE.ENTITY_OUTLINE,
      attachHistory,
      attachScenes: false,
      attachEntityContext: true,
      generateCollections: [],
      editorOperation: null
    });
  }

  if (SCENE_TOPIC_PATTERN.test(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.DISCUSS_SCENES,
      contextProfile: CONTEXT_PROFILE.SCENES_OUTLINE,
      attachHistory,
      attachScenes: true,
      attachEntityContext,
      generateCollections: [],
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
      contextProfile: resolveContextProfile({
        attachEntityContext,
        attachScenes: false,
        extractFromScript,
        defaultProfile: CONTEXT_PROFILE.SCRIPT_TAIL
      }),
      attachHistory,
      attachScenes: false,
      attachEntityContext,
      generateCollections,
      editorOperation: EDITOR_OPERATION.APPEND
    });
  }

  if (DISCUSS_SCRIPT_PATTERN.test(normalizedPrompt)) {
    return buildResolution({
      outcome: CHAT_OUTCOME.DISCUSS_SCRIPT,
      contextProfile: resolveContextProfile({
        attachEntityContext,
        attachScenes: false,
        extractFromScript,
        defaultProfile: CONTEXT_PROFILE.SCRIPT_TAIL
      }),
      attachHistory,
      attachScenes: false,
      attachEntityContext,
      generateCollections: [],
      editorOperation: null
    });
  }

  return buildResolution({
    outcome: CHAT_OUTCOME.WRITE_CONTINUE,
    contextProfile: resolveContextProfile({
      attachEntityContext,
      attachScenes: false,
      extractFromScript,
      defaultProfile: CONTEXT_PROFILE.SCRIPT_TAIL
    }),
    attachHistory,
    attachScenes: false,
    attachEntityContext,
    generateCollections,
    editorOperation: EDITOR_OPERATION.APPEND
  });
};
