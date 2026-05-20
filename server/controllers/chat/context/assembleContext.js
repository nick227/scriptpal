import { normalizeScriptForPrompt } from '../../langchain/chains/helpers/ScriptNormalization.js';
import { INTENT_TYPES } from '../../langchain/constants.js';
import { buildScriptContextPayload, buildScriptMetadata } from './script.js';
import { filterContextOverrides } from './overrides.js';
import { truncateScriptToTail } from './scriptTail.js';
import { HistoryManager } from '../history/HistoryManager.js';
import { isAttachHistoryRequest } from '../intent/heuristics.js';
import { CONTEXT_PROFILE } from '../intent/outcomes.js';
import { buildChatChainConfig } from '../chain/config.js';
import { SCRIPT_TAG_PATTERN } from '../../langchain/chains/helpers/WritingResponseNormalizer.js';
import { getSceneOutline, formatSceneOutlineForPrompt } from './sceneOutline.js';

export { CONTEXT_PROFILE };

const DEFAULT_PROTECTED_KEYS = [
  'scriptId',
  'scriptTitle',
  'scriptContent',
  'includeScriptContext',
  'attachScriptContext',
  'expectsFormattedScript',
  'scriptMetadata',
  'scriptCollections',
  'chainConfig',
  'intent',
  'userId',
  'chatRequestId'
];

const MAX_HISTORY_TURNS = 3;
const MAX_HISTORY_CONTENT = 280;

const slimHistoryContent = (msg) => {
  let content = typeof msg?.content === 'string' ? msg.content.trim() : '';
  if (!content) {
    return '';
  }
  if (SCRIPT_TAG_PATTERN.test(content)) {
    return 'Added content to your script.';
  }
  if (content.length > MAX_HISTORY_CONTENT) {
    return `${content.slice(0, MAX_HISTORY_CONTENT - 3)}...`;
  }
  return content;
};

const buildSlimChatHistory = (historyRows) => {
  if (!Array.isArray(historyRows)) {
    return [];
  }

  return historyRows
    .map((msg) => {
      const content = slimHistoryContent(msg);
      if (!content) {
        return null;
      }
      return {
        role: msg.type === 'user' ? 'user' : 'assistant',
        content
      };
    })
    .filter(Boolean)
    .slice(-MAX_HISTORY_TURNS);
};

/**
 * Lazy context assembly — minimal by default, script tail for writing.
 */
export const assembleContext = async ({
  profile = CONTEXT_PROFILE.MINIMAL,
  script = null,
  scriptId = null,
  userId = null,
  intent = null,
  prompt = '',
  attachHistory = false,
  chatRequestId = null,
  overrides = {},
  protectedKeys = DEFAULT_PROTECTED_KEYS,
  attachScenes = false,
  selection = null
}) => {
  const useTail = profile === CONTEXT_PROFILE.SCRIPT_TAIL
    || profile === CONTEXT_PROFILE.SELECTION;
  const useScenesOutline = profile === CONTEXT_PROFILE.SCENES_OUTLINE
    || (attachScenes && profile !== CONTEXT_PROFILE.MINIMAL);
  const bundle = buildScriptContextPayload(script, {
    includeScriptContext: false,
    allowStructuredExtraction: true,
    updatedAtKey: 'lastUpdated'
  });

  let scriptContent = '';
  if (useTail && script) {
    const fullContent = normalizeScriptForPrompt(script?.content || '', {
      allowStructuredExtraction: true
    });
    scriptContent = truncateScriptToTail(fullContent);
  }

  const scriptMetadata = script ? buildScriptMetadata(script, { updatedAtKey: 'lastUpdated' }) : null;

  let sceneOutline = '';
  if (useScenesOutline && scriptId) {
    const scenes = await getSceneOutline(scriptId);
    sceneOutline = formatSceneOutlineForPrompt(scenes);
  }

  let selectionBlock = '';
  let selectionRange = null;
  if (profile === CONTEXT_PROFILE.SELECTION && selection && typeof selection === 'object') {
    const text = selection.text ?? selection.content ?? '';
    if (typeof text === 'string' && text.trim()) {
      selectionBlock = text.trim();
    }
    if (Number.isInteger(selection.startLine) && Number.isInteger(selection.endLine)) {
      selectionRange = {
        startLine: selection.startLine,
        endLine: selection.endLine
      };
    }
  }

  const resolvedAttachHistory = attachHistory || isAttachHistoryRequest(prompt);

  const context = {
    userId,
    scriptId,
    intent,
    chatRequestId,
    scriptTitle: bundle.scriptTitle,
    scriptDescription: bundle.scriptDescription,
    scriptContent,
    scriptMetadata,
    scriptCollections: null,
    sceneOutline,
    selection: selectionBlock || null,
    selectionRange,
    includeScriptContext: useTail,
    attachScriptContext: useTail,
    attachScenes: useScenesOutline,
    disableHistory: !resolvedAttachHistory,
    chatHistory: [],
    chainConfig: buildChatChainConfig(),
    prompt,
    contextProfile: profile
  };

  if (resolvedAttachHistory && userId && scriptId) {
    const historyManager = new HistoryManager(userId, scriptId);
    const rows = await historyManager.getHistory(MAX_HISTORY_TURNS, scriptId);
    context.chatHistory = buildSlimChatHistory(rows);
    context.disableHistory = context.chatHistory.length === 0;
  }

  const safeOverrides = filterContextOverrides(overrides, protectedKeys);
  return { ...context, ...safeOverrides };
};

/**
 * Writing / mutation chain context: script tail, no collections, history gated.
 */
export const buildWritingChainContext = async ({
  script,
  scriptId,
  userId,
  intent,
  prompt,
  chatRequestId = null,
  baseContext = {},
  promptDefinition = null,
  chainConfig = null
}) => {
  const attachHistory = Boolean(baseContext.attachHistory) || isAttachHistoryRequest(prompt);

  const assembled = await assembleContext({
    profile: CONTEXT_PROFILE.SCRIPT_TAIL,
    script,
    scriptId,
    userId,
    intent,
    prompt,
    attachHistory,
    chatRequestId
  });

  const safeOverrides = filterContextOverrides(baseContext, DEFAULT_PROTECTED_KEYS);

  return {
    ...assembled,
    ...safeOverrides,
    systemInstruction: promptDefinition?.systemInstruction ?? assembled.systemInstruction,
    expectsFormattedScript: promptDefinition?.expectsFormattedScript ?? false,
    chainConfig: chainConfig ?? assembled.chainConfig,
    chatRequestId,
    originalUserPrompt: prompt
  };
};

export const assembleContextFromResolution = async ({
  resolution,
  script,
  scriptId,
  userId,
  intent,
  prompt,
  chatRequestId = null,
  overrides = {},
  selection = null
}) => assembleContext({
  profile: resolution.contextProfile,
  script,
  scriptId,
  userId,
  intent,
  prompt,
  attachHistory: resolution.attachHistory,
  attachScenes: resolution.attachScenes,
  chatRequestId,
  selection,
  overrides
});
