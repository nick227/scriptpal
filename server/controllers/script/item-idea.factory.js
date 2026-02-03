import prisma from '../../db/prismaClient.js';
import { router } from '../langchain/router/index.js';
import { getPromptById } from '../../../shared/promptRegistry.js';
import { createIntentResult } from '../common/ai-response.service.js';
import { loadScriptOrThrow } from '../script-services/scriptRequestUtils.js';
import { buildScriptContextBundle } from './context-builder.service.js';
import { parseNumericId } from '../../utils/idUtils.js';
import { requireNumericParam } from '../../utils/requestUtils.js';
import { listScriptItems } from '../../utils/queryUtils.js';

const normalizeDraft = (item, draft) => {
  const hasDraft = draft && typeof draft === 'object';
  const tags = hasDraft && Array.isArray(draft.tags) ? draft.tags : item?.tags || [];
  return {
    id: item?.id ?? null,
    title: hasDraft && typeof draft.title === 'string' ? draft.title : item?.title || '',
    description: hasDraft && typeof draft.description === 'string' ? draft.description : item?.description || '',
    notes: hasDraft && typeof draft.notes === 'string' ? draft.notes : item?.notes || '',
    tags,
    sortIndex: item?.sortIndex ?? null
  };
};

export const createScriptItemIdeaController = (options) => {
  const { modelName, itemLabel, idParam, promptId, intentType } = options;
  if (!modelName || !itemLabel || !idParam || !promptId || !intentType) {
    throw new Error('Script item idea controller factory requires modelName, itemLabel, idParam, promptId, and intentType');
  }
  const model = prisma[modelName];
  if (!model) {
    throw new Error(`Prisma model not found: ${modelName}`);
  }
  const prompt = getPromptById(promptId);
  if (!prompt) {
    throw new Error(`${itemLabel} idea prompt definition is missing from the registry`);
  }

  return async(req, res) => {
    try {
      const scriptId = requireNumericParam(req, res, 'scriptId', 'script ID');
      if (!scriptId) {
        return;
      }
      const itemId = parseNumericId(req.params[idParam]);

      const { script } = await loadScriptOrThrow(req, {
        required: true,
        allowPublic: false,
        requireEditable: true
      });

      let item = null;
      if (itemId) {
        item = await model.findFirst({
          where: { id: itemId, scriptId }
        });
        if (!item) {
          return res.status(404).json({ error: `${itemLabel} not found` });
        }
      }

      const items = await listScriptItems(model, scriptId);
      const otherItems = items
        .filter(entry => (itemId ? Number(entry.id) !== Number(itemId) : true))
        .map(entry => ({
          id: entry.id,
          title: entry.title,
          description: entry.description,
          sortIndex: entry.sortIndex
        }));

      const draft = req.body && req.body.draft ? req.body.draft : null;
      const currentItem = normalizeDraft(item, draft);
      const contextBundle = await buildScriptContextBundle({
        scriptId,
        script,
        includeScriptContext: true,
        allowStructuredExtraction: true
      });

      const intentResult = createIntentResult(intentType);
      const response = await router.route(intentResult, {
        userId: req.userId,
        scriptId,
        intent: intentType,
        scriptTitle: contextBundle.scriptTitle,
        scriptDescription: contextBundle.scriptDescription,
        scriptContent: contextBundle.scriptContent,
        currentItem,
        otherItems,
        scriptCollections: contextBundle.scriptCollections,
        disableHistory: true,
        chainConfig: {
          shouldGenerateQuestions: false
        },
        systemInstruction: prompt.systemInstruction
      }, prompt.userPrompt);

      const payload = response?.response || response;
      res.status(200).json({
        title: payload?.title || '',
        description: payload?.description || ''
      });
    } catch (error) {
      console.error(`Error generating ${itemLabel.toLowerCase()} idea:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
