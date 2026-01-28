import { ScriptManager } from './scripts/ScriptManager.js';
import { router } from './langchain/router/index.js';
import { INTENT_TYPES, validateAiResponse } from './langchain/constants.js';
import { getPromptById } from '../../shared/promptRegistry.js';
import { buildAiResponse, createIntentResult } from './aiResponse.js';
import { buildPromptContext } from './contextBuilder.js';

const NEXT_FIVE_LINES_PROMPT = getPromptById('next-five-lines');

if (!NEXT_FIVE_LINES_PROMPT) {
  throw new Error('Next five lines prompt definition is missing from the registry');
}

class NextLinesController {
  constructor () {
    this.scriptManager = new ScriptManager();
  }

  async trigger (req, res) {
    const scriptId = req.params?.scriptId || req.body?.scriptId;
    if (!scriptId) {
      return res.status(400).json({ error: 'scriptId is required' });
    }

    try {
      const script = await this.scriptManager.getScript(scriptId);
      const context = await this.buildContext(scriptId, script, req.body?.context || {});
      const intentResult = createIntentResult(INTENT_TYPES.NEXT_FIVE_LINES);

      const response = await router.route(intentResult, context, NEXT_FIVE_LINES_PROMPT.userPrompt);
      const validation = validateAiResponse(INTENT_TYPES.NEXT_FIVE_LINES, response);
      if (!validation.valid) {
        console.warn('[NextLinesController] Contract validation failed', {
          intent: INTENT_TYPES.NEXT_FIVE_LINES,
          errors: validation.errors
        });
        return res.status(400).json({
          error: 'contract_validation_failed',
          details: validation.errors
        });
      }

      const responseWithMetadata = {
        ...response,
        metadata: {
          ...response.metadata,
          contractValidation: validation
        }
      };

      const payload = buildAiResponse({
        intentResult,
        scriptId,
        scriptTitle: script.title,
        response: responseWithMetadata,
        mode: INTENT_TYPES.NEXT_FIVE_LINES,
        validation
      });

      return res.status(200).json(payload);
    } catch (error) {
      console.error('NextLinesController error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  async buildContext (scriptId, script, overrides = {}) {
    const includeScriptContext = NEXT_FIVE_LINES_PROMPT.attachScriptContext ?? false;
    return buildPromptContext({
      scriptId,
      script,
      userId: overrides.userId,
      intent: INTENT_TYPES.NEXT_FIVE_LINES,
      promptDefinition: NEXT_FIVE_LINES_PROMPT,
      includeScriptContext,
      allowStructuredExtraction: false,
      systemInstruction: NEXT_FIVE_LINES_PROMPT.systemInstruction,
      chainConfig: {
        shouldGenerateQuestions: false,
        modelConfig: {
          temperature: 0.3,
          response_format: { type: 'json_object' }
        }
      },
      overrides: {
        ...overrides,
        disableHistory: true
      }
    });
  }
}

export default new NextLinesController();
