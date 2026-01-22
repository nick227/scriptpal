import scriptModel from '../models/script.js';
import { router } from './langchain/router/index.js';
import { INTENT_TYPES } from './langchain/constants.js';
import { SYSTEM_PROMPTS_MAP } from '../../shared/systemPrompts.js';

class SystemPromptController {
  async trigger(req, res) {
    try {
      const { promptType, scriptId: bodyScriptId, context = {} } = req.body || {};
      if (!promptType) {
        return res.status(400).json({ error: 'promptType is required' });
      }

      const definition = SYSTEM_PROMPTS_MAP[promptType];
      if (!definition) {
        return res.status(400).json({ error: `Unknown promptType: ${promptType}` });
      }

      const scriptId = bodyScriptId || context.scriptId || null;
      const script = scriptId ? await scriptModel.getScript(scriptId) : null;
      const intentResult = {
        intent: INTENT_TYPES.EVERYTHING_ELSE,
        confidence: 1,
        target: null,
        value: null
      };

      const enrichedContext = {
        userId: req.userId || null,
        scriptId,
        scriptTitle: script?.title,
        scriptMetadata: script || null,
        promptType,
        systemInstruction: definition.systemInstruction,
        ...context
      };

      const response = await router.route(intentResult, enrichedContext, definition.userPrompt);
      return res.status(200).json(response);
    } catch (error) {
      console.error('System prompt controller error:', error);
      return res.status(500).json({ error: 'Failed to process system prompt' });
    }
  }
}

export default new SystemPromptController();
