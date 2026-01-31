import { buildScriptContextPayload } from './chat/context/script.js';
import { filterContextOverrides } from './chat/context/overrides.js';
import { getScriptCollections } from './scriptContextCollections.js';

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
  'userId'
];

const resolveCollectionsPolicy = (policy, includeScriptContext) => {
  if (policy === 'always') {
    return true;
  }
  if (policy === 'never') {
    return false;
  }
  return Boolean(includeScriptContext);
};

export const buildScriptContextBundle = async ({
  scriptId,
  script,
  includeScriptContext = false,
  allowStructuredExtraction = true,
  updatedAtKey = 'updatedAt',
  collectionsPolicy = 'when-include'
}) => {
  const {
    scriptTitle,
    scriptDescription,
    scriptContent,
    scriptMetadata
  } = buildScriptContextPayload(script, {
    includeScriptContext,
    allowStructuredExtraction,
    updatedAtKey
  });

  const shouldAttachCollections = resolveCollectionsPolicy(collectionsPolicy, includeScriptContext);
  const scriptCollections = shouldAttachCollections
    ? await getScriptCollections(scriptId)
    : null;

  return {
    scriptTitle,
    scriptDescription,
    scriptContent,
    scriptMetadata,
    scriptCollections
  };
};

export const buildPromptContext = async ({
  scriptId,
  script,
  userId,
  intent,
  promptDefinition,
  includeScriptContext,
  allowStructuredExtraction = true,
  updatedAtKey = 'updatedAt',
  collectionsPolicy = 'when-include',
  chainConfig = null,
  systemInstruction = null,
  overrides = {},
  protectedKeys = DEFAULT_PROTECTED_KEYS
}) => {
  const resolvedIncludeScriptContext = typeof includeScriptContext === 'boolean'
    ? includeScriptContext
    : (promptDefinition?.attachScriptContext ?? false);

  const bundle = await buildScriptContextBundle({
    scriptId,
    script,
    includeScriptContext: resolvedIncludeScriptContext,
    allowStructuredExtraction,
    updatedAtKey,
    collectionsPolicy
  });

  const safeOverrides = filterContextOverrides(overrides, protectedKeys);

  return {
    userId: userId || null,
    scriptId,
    intent: intent || null,
    includeScriptContext: resolvedIncludeScriptContext,
    attachScriptContext: resolvedIncludeScriptContext,
    expectsFormattedScript: promptDefinition?.expectsFormattedScript ?? false,
    systemInstruction: systemInstruction || promptDefinition?.systemInstruction,
    chainConfig,
    ...bundle,
    ...safeOverrides
  };
};
