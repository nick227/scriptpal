import prisma from '../../../db/prismaClient.js';
import { router } from '../../langchain/router/index.js';
import { getPromptById } from '../../../../shared/promptRegistry.js';
import { createIntentResult } from '../../common/ai-response.service.js';
import { INTENT_TYPES } from '../../langchain/constants.js';
import { loadScriptOrThrow } from '../../script-services/scriptRequestUtils.js';
import { buildScriptContextBundle } from '../context-builder.service.js';
import { parseNumericId } from '../../../utils/idUtils.js';
import { requireNumericParam } from '../../../utils/requestUtils.js';
import { listScriptItems } from '../../../utils/queryUtils.js';

const OUTLINE_IDEA_PROMPT = getPromptById('outline-idea');
if (!OUTLINE_IDEA_PROMPT) {
  throw new Error('Outline idea prompt definition is missing from the registry');
}

const normalizeDraft = (item, draft) => {
  const hasDraft = draft && typeof draft === 'object';
  const items = hasDraft && Array.isArray(draft.items)
    ? draft.items.map((t) => (typeof t === 'string' ? { text: t } : (t && typeof t.text === 'string' ? t : { text: String(t ?? '') })))
    : (item?.items ?? []);
  return {
    id: item?.id ?? null,
    title: hasDraft && typeof draft.title === 'string' ? draft.title : item?.title ?? '',
    items,
    sortIndex: item?.sortIndex ?? null
  };
};

export default async (req, res) => {
  try {
    const scriptId = requireNumericParam(req, res, 'scriptId', 'script ID');
    if (!scriptId) return;
    const outlineId = parseNumericId(req.params.outlineId);

    const { script } = await loadScriptOrThrow(req, {
      required: true,
      allowPublic: false,
      requireEditable: true
    });

    let outline = null;
    if (outlineId) {
      outline = await prisma.outline.findFirst({
        where: { id: outlineId, scriptId }
      });
      if (!outline) {
        return res.status(404).json({ error: 'Outline not found' });
      }
    }

    const outlines = await listScriptItems(prisma.outline, scriptId);
    const otherOutlines = outlines
      .filter((o) => (outlineId ? Number(o.id) !== Number(outlineId) : true))
      .map((o) => ({ id: o.id, title: o.title, sortIndex: o.sortIndex }));

    const draft = req.body?.draft ?? null;
    const currentOutline = normalizeDraft(outline, draft);

    const contextBundle = await buildScriptContextBundle({
      scriptId,
      script,
      includeScriptContext: true,
      allowStructuredExtraction: true
    });

    const intentResult = createIntentResult(INTENT_TYPES.OUTLINE_IDEA);
    const response = await router.route(intentResult, {
      userId: req.userId,
      scriptId,
      intent: INTENT_TYPES.OUTLINE_IDEA,
      scriptTitle: contextBundle.scriptTitle,
      scriptDescription: contextBundle.scriptDescription,
      scriptContent: contextBundle.scriptContent,
      currentOutline,
      otherOutlines,
      scriptCollections: contextBundle.scriptCollections,
      disableHistory: true,
      chainConfig: { shouldGenerateQuestions: false },
      systemInstruction: OUTLINE_IDEA_PROMPT.systemInstruction
    }, OUTLINE_IDEA_PROMPT.userPrompt);

    const payload = response?.response || response;
    const items = Array.isArray(payload?.items)
      ? payload.items.map((i) => (typeof i === 'string' ? { text: i, source: 'ai' } : { text: i?.text ?? '', source: 'ai' }))
      : [];

    res.status(200).json({
      title: payload?.title ?? '',
      items
    });
  } catch (error) {
    console.error('Error generating outline idea:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
