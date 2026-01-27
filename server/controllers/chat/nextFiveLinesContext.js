import { filterContextOverrides } from './contextUtils.js';
import { buildScriptContextPayload } from './scriptContextUtils.js';
import { buildNextFiveLinesChainConfig } from './chainConfigUtils.js';

const PROTECTED_KEYS = [
  'scriptId',
  'scriptTitle',
  'scriptContent',
  'includeScriptContext',
  'attachScriptContext',
  'expectsFormattedScript',
  'scriptMetadata',
  'chainConfig'
];

export const buildNextFiveLinesContext = ({
  scriptId,
  script,
  promptDefinition,
  overrides = {}
}) => {
  const includeScriptContext = promptDefinition.attachScriptContext ?? false;
  const {
    scriptTitle,
    scriptDescription,
    scriptContent,
    scriptMetadata
  } = buildScriptContextPayload(script, {
    includeScriptContext,
    allowStructuredExtraction: true,
    updatedAtKey: 'updatedAt'
  });
  const safeOverrides = filterContextOverrides(overrides, PROTECTED_KEYS);

  return {
    userId: overrides.userId || null,
    scriptId,
    scriptTitle,
    scriptDescription,
    scriptContent,
    includeScriptContext,
    attachScriptContext: includeScriptContext,
    expectsFormattedScript: promptDefinition.expectsFormattedScript ?? false,
    disableHistory: true,
    scriptMetadata,
    chainConfig: buildNextFiveLinesChainConfig(),
    systemInstruction: promptDefinition.systemInstruction,
    ...safeOverrides
  };
};
