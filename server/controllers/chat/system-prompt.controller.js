import { router } from '../langchain/router/index.js';
import { INTENT_TYPES } from '../langchain/constants.js';
import { SYSTEM_PROMPTS_MAP } from '../../../shared/systemPrompts.js';
import { logger } from '../../utils/logger.js';
import { buildAiResponse } from '../common/ai-response.service.js';
import { buildScriptContextBundle } from '../script/context-builder.service.js';
import { loadScriptOrThrow } from '../script-services/scriptRequestUtils.js';

class SystemPromptController {
  async trigger(req, res) {
    let promptType;
    let scriptId;
    let context;
    try {
      ({ promptType, scriptId: scriptId, context = {} } = req.body || {});
      if (!promptType) {
        return res.status(400).json({ error: 'promptType is required' });
      }

      const definition = SYSTEM_PROMPTS_MAP[promptType];
      if (!definition) {
        return res.status(400).json({ error: `Unknown promptType: ${promptType}` });
      }

      const resolvedScriptId = scriptId || context.scriptId || null;
      scriptId = resolvedScriptId;
      let script = null;
      let scriptCollections = null;
      let scriptContent = '';
      let scriptDescription = '';
      let scriptMetadata = null;
      if (resolvedScriptId) {
        const request = {
          ...req,
          body: {
            ...req.body,
            scriptId: resolvedScriptId
          }
        };
        const result = await loadScriptOrThrow(request, {
          required: true,
          allowPublic: false,
          requireEditable: true
        });
        script = result.script;
        scriptMetadata = result.script || null;
        if (definition.attachScriptContext) {
          const contextBundle = await buildScriptContextBundle({
            scriptId: resolvedScriptId,
            script,
            includeScriptContext: true,
            allowStructuredExtraction: true
          });
          scriptCollections = contextBundle.scriptCollections;
          scriptContent = contextBundle.scriptContent || '';
          scriptDescription = contextBundle.scriptDescription || '';
          scriptMetadata = contextBundle.scriptMetadata || scriptMetadata;
        }
      }
      const chatRequestId = context?.chatRequestId || req.headers['x-correlation-id']
        || `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const resolvedIntent = definition.intent || INTENT_TYPES.SCRIPT_REFLECTION;
      const promptIntent = resolvedIntent === INTENT_TYPES.SCRIPT_CONVERSATION
        ? INTENT_TYPES.SCRIPT_REFLECTION
        : resolvedIntent;

      const intentResult = {
        intent: promptIntent,
        confidence: 1,
        target: null,
        value: null
      };

      const enrichedContext = {
        ...context,
        userId: req.userId || null,
        scriptId: resolvedScriptId,
        scriptTitle: script?.title,
        scriptDescription,
        scriptContent,
        scriptMetadata,
        scriptCollections,
        disableHistory: true,
        chatRequestId,
        promptType,
        systemInstruction: definition.systemInstruction,
        originalUserPrompt: context?.triggerPrompt ?? promptType ?? definition.userPrompt,
        chainConfig: {
          shouldGenerateQuestions: false
        }
      };

      const response = await router.route(intentResult, enrichedContext, definition.userPrompt);
      const responseType = response?.type || response?.response?.type || 'unknown';
      const responseText = typeof response?.response === 'string'
        ? response.response
        : (typeof response?.message === 'string' ? response.message : '');
      logger.info('System prompt completed', {
        scriptId: resolvedScriptId,
        promptType,
        chain: responseType,
        responseLength: responseText.length,
        chatRequestId,
        success: true
      });
      const responsePayload = buildAiResponse({
        intentResult,
        scriptId: resolvedScriptId,
        scriptTitle: script?.title,
        response,
        mode: 'system-prompt'
      });
      return res.status(200).json(responsePayload);
    } catch (error) {
      logger.error('System prompt controller error', { error, promptType, scriptId });
      const status = error?.status || 500;
      const message = error?.status ? error.message : 'Failed to process system prompt';
      return res.status(status).json({ error: message });
    }
  }
}

export default new SystemPromptController();
