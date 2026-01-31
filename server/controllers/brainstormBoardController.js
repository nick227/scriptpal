import brainstormRepository from '../repositories/brainstormRepository.js';

const CATEGORY_KEYS = new Set(['general', 'story', 'character', 'location']);

const parseBoardId = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const parseNotes = (notes) => {
  if (!Array.isArray(notes)) {
    return null;
  }
  return notes.map((note) => ({
    category: note.category,
    content: note.content
  }));
};

const validateNotes = (notes) => {
  for (const note of notes) {
    if (!note || typeof note.content !== 'string' || !note.content.trim()) {
      return 'Note content is required';
    }
    if (!CATEGORY_KEYS.has(note.category)) {
      return 'Invalid note category';
    }
  }
  return null;
};

const brainstormBoardController = {
  list: async(req, res) => {
    try {
      const boards = await brainstormRepository.listByUser(req.userId);
      res.json({ boards });
    } catch (error) {
      console.error('[BrainstormBoardController] list error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  get: async(req, res) => {
    const boardId = parseBoardId(req.params.id);
    if (!boardId) {
      return res.status(400).json({ error: 'Invalid board id' });
    }
    try {
      const board = await brainstormRepository.getByIdForUser(boardId, req.userId);
      if (!board) {
        return res.status(404).json({ error: 'Board not found' });
      }
      res.json(board);
    } catch (error) {
      console.error('[BrainstormBoardController] get error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  create: async(req, res) => {
    const seed = req.body && typeof req.body.seed === 'string' ? req.body.seed.trim() : '';
    const title = req.body && typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const notes = parseNotes(req.body ? req.body.notes : undefined);
    if (!seed) {
      return res.status(400).json({ error: 'Seed is required' });
    }
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!notes) {
      return res.status(400).json({ error: 'Notes must be an array' });
    }
    const noteError = validateNotes(notes);
    if (noteError) {
      return res.status(400).json({ error: noteError });
    }

    try {
      const board = await brainstormRepository.createForUser({
        userId: req.userId,
        title,
        seed,
        notes
      });
      res.status(201).json(board);
    } catch (error) {
      console.error('[BrainstormBoardController] create error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  update: async(req, res) => {
    const boardId = parseBoardId(req.params.id);
    if (!boardId) {
      return res.status(400).json({ error: 'Invalid board id' });
    }
    const seed = req.body && typeof req.body.seed === 'string' ? req.body.seed.trim() : '';
    const title = req.body && typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const notes = parseNotes(req.body ? req.body.notes : undefined);
    if (!seed) {
      return res.status(400).json({ error: 'Seed is required' });
    }
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!notes) {
      return res.status(400).json({ error: 'Notes must be an array' });
    }
    const noteError = validateNotes(notes);
    if (noteError) {
      return res.status(400).json({ error: noteError });
    }

    try {
      const board = await brainstormRepository.updateForUser({
        id: boardId,
        userId: req.userId,
        title,
        seed,
        notes
      });
      if (!board) {
        return res.status(404).json({ error: 'Board not found' });
      }
      res.json(board);
    } catch (error) {
      console.error('[BrainstormBoardController] update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default brainstormBoardController;
