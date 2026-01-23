import scriptModel from '../models/script.js';
import { router } from './langchain/router/index.js';
import { INTENT_TYPES } from './langchain/constants.js';
import { SYSTEM_PROMPTS_MAP } from '../../shared/systemPrompts.js';
import { logger } from '../utils/logger.js';

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
      const script = resolvedScriptId ? await scriptModel.getScript(resolvedScriptId) : null;
      const intentResult = {
        intent: INTENT_TYPES.SCRIPT_CONVERSATION,
        confidence: 1,
        target: null,
        value: null
      };

      const enrichedContext = {
        userId: req.userId || null,
        scriptId: resolvedScriptId,
        scriptTitle: script?.title,
        scriptMetadata: script || null,
        promptType,
        systemInstruction: definition.systemInstruction,
        ...context
      };

      const response = await router.route(intentResult, enrichedContext, definition.userPrompt);
      logger.info('System prompt completed', {
        scriptId: resolvedScriptId,
        promptType,
        chain: response?.type || 'unknown',
        responseLength: response?.response ? response.response.length : 0,
        success: true
      });
      return res.status(200).json(response);
    } catch (error) {
      logger.error('System prompt controller error', { error, promptType, scriptId });
      return res.status(500).json({ error: 'Failed to process system prompt' });
    }
  }
}

export default new SystemPromptController();
