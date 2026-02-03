import { router } from '../langchain/router/index.js';
import { buildAiResponse, createIntentResult } from '../common/ai-response.service.js';
import { getPromptById } from '../../../shared/promptRegistry.js';
import brainstormRepository from '../../repositories/brainstormRepository.js';
import { logger } from '../../utils/logger.js';

const CATEGORY_TO_PROMPT = {
  general: 'brainstorm-general',
  story: 'brainstorm-story',
  character: 'brainstorm-character',
  location: 'brainstorm-location',
  title: 'brainstorm-title'
};

const formatNotesByCategory = (notes, category) => {
  const items = notes
    .filter(note => note.category === category)
    .map(note => `- ${note.content}`);
  return items.length ? items.join('\n') : '- None';
};

const parseSeeds = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map(seed => seed.trim())
    .filter(Boolean);
};

const buildBrainstormContext = (board) => {
  const notes = Array.isArray(board.notes) ? board.notes : [];
  const seeds = parseSeeds(board.seed);
  const seedLine = seeds.length ? `Seeds: ${seeds.join(', ')}` : 'Seeds: (none)';
  return `
BRAINSTORM CONTEXT
${seedLine}

General:
${formatNotesByCategory(notes, 'general')}

Story:
${formatNotesByCategory(notes, 'story')}

Character:
${formatNotesByCategory(notes, 'character')}

Location:
${formatNotesByCategory(notes, 'location')}
`.trim();
};

const extractResponseContent = (response) => {
  if (!response || typeof response !== 'object') {
    return '';
  }
  if (response.response && typeof response.response === 'string') {
    return response.response;
  }
  if (response.response && typeof response.response.content === 'string') {
    return response.response.content;
  }
  if (response.result && typeof response.result.content === 'string') {
    return response.result.content;
  }
  if (typeof response.content === 'string') {
    return response.content;
  }
  return '';
};

const isValidJsonArray = (payload) => Array.isArray(payload) &&
  payload.every((item) => typeof item === 'string' && item.trim());

const isValidTitlePayload = (payload) =>
  payload &&
  typeof payload === 'object' &&
  typeof payload.title === 'string' &&
  payload.title.trim();

const brainstormPromptController = {
  trigger: async(req, res) => {
    const boardId = Number(req.params.id);
    const category = String(req.params.category || '').toLowerCase();
    if (!Number.isFinite(boardId)) {
      return res.status(400).json({ error: 'Invalid board id' });
    }

    const promptId = CATEGORY_TO_PROMPT[category];
    if (!promptId) {
      return res.status(400).json({ error: 'Invalid brainstorm category' });
    }

    const definition = getPromptById(promptId);
    if (!definition) {
      return res.status(400).json({ error: `Unknown promptType: ${promptId}` });
    }

    try {
      const board = await brainstormRepository.getByIdForUser(boardId, req.userId);
      if (!board) {
        return res.status(404).json({ error: 'Board not found' });
      }

      const contextBlock = buildBrainstormContext(board);
      const userPrompt = `${definition.userPrompt}\n\n${contextBlock}`;
      const intentResult = createIntentResult(definition.intent);
      const enrichedContext = {
        userId: req.userId || null,
        promptType: promptId,
        brainstormBoardId: board.id,
        brainstormSeed: board.seed,
        brainstormNotes: board.notes || [],
        systemInstruction: definition.systemInstruction
      };

      const response = await router.route(intentResult, enrichedContext, userPrompt);
      const rawContent = extractResponseContent(response);
      let parsed = null;
      try {
        parsed = rawContent ? JSON.parse(rawContent) : null;
      } catch (error) {
        parsed = null;
      }
      if (category === 'title') {
        if (!isValidTitlePayload(parsed)) {
          return res.status(422).json({ error: 'Invalid AI response format' });
        }
      } else if (!isValidJsonArray(parsed)) {
        return res.status(422).json({ error: 'Invalid AI response format' });
      }
      const responseType = response && response.type ? response.type : 'unknown';
      const responseLength = response && response.response ? response.response.length : 0;
      logger.info('Brainstorm prompt completed', {
        boardId,
        category,
        promptId,
        chain: responseType,
        responseLength,
        success: true
      });

      const responsePayload = buildAiResponse({
        intentResult,
        response,
        mode: 'brainstorm-prompt'
      });

      return res.status(200).json(responsePayload);
    } catch (error) {
      logger.error('Brainstorm prompt controller error', { error, boardId, category });
      const status = error && error.status ? error.status : 500;
      const message = error && error.status ? error.message : 'Failed to process brainstorm prompt';
      return res.status(status).json({ error: message });
    }
  }
};

export default brainstormPromptController;
