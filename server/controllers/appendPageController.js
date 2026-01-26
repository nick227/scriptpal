import { generateAppendPage, APPEND_PAGE_INTENT, APPEND_SCRIPT_INTENT } from './scripts/AppendPageService.js';
import scriptRepository from '../repositories/scriptRepository.js';
import { buildAiResponse, createIntentResult } from './aiResponse.js';

const appendPageController = {
  appendPage: async(req, res) => {
    try {
      const scriptId = Number(req.params.id);
      if (!scriptId) {
        return res.status(400).json({ error: 'Invalid script ID' });
      }

      const existingScript = await scriptRepository.getById(scriptId);
      if (!existingScript) {
        return res.status(404).json({ error: 'Script not found' });
      }
      if (existingScript.userId !== req.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const result = await generateAppendPage({
        scriptId,
        userId: req.userId,
        prompt
      });

      const intentResult = createIntentResult(APPEND_SCRIPT_INTENT);
      const responsePayload = buildAiResponse({
        intentResult,
        scriptId,
        scriptTitle: result.scriptTitle,
        response: {
          content: result.responseText,
          assistantResponse: result.assistantResponse || result.responseText,
          metadata: {
            formattedScript: result.formattedScript,
            generationMode: APPEND_PAGE_INTENT
          }
        }
      });

      return res.status(200).json(responsePayload);
    } catch (error) {
      console.error('Error appending page:', error);
      if (error.message === 'Script not found') {
        return res.status(404).json({ error: 'Script not found' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default appendPageController;
