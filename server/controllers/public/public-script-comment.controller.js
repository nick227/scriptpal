import scriptCommentRepository from '../../repositories/scriptCommentRepository.js';
import scriptRepository from '../../repositories/scriptRepository.js';

const MAX_COMMENT_LENGTH = 500;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const buildAuthorLabel = (user) => {
  if (!user) return 'Anonymous';
  return user.email || user.username || `User ${user.id}`;
};

const publicScriptCommentController = {
  list: async (req, res) => {
    const scriptId = Number(req.params.id);
    if (!Number.isFinite(scriptId)) {
      return res.status(400).json({ error: 'Invalid script id' });
    }

    try {
      const script = await scriptRepository.getPublicScriptById(scriptId);
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }

      const page = toPositiveInt(req.query.page, 1);
      const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE));
      const offset = (page - 1) * pageSize;

      const [comments, count] = await Promise.all([
        scriptCommentRepository.listByScript(scriptId, { limit: pageSize, offset }),
        scriptCommentRepository.countByScript(scriptId)
      ]);

      res.json({
        comments,
        count,
        page,
        pageSize,
        hasMore: offset + comments.length < count
      });
    } catch (error) {
      console.error('[PublicScriptCommentController] list error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  create: async (req, res) => {
    const scriptId = Number(req.params.id);
    if (!Number.isFinite(scriptId)) {
      return res.status(400).json({ error: 'Invalid script id' });
    }

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ error: `Comment must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    try {
      const script = await scriptRepository.getPublicScriptById(scriptId);
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }

      const authorLabel = buildAuthorLabel(req.user);
      const userId = req.userId;
      const comment = await scriptCommentRepository.createForPublicScript({
        scriptId,
        userId,
        content,
        authorLabel
      });

      const count = await scriptCommentRepository.countByScript(scriptId);
      res.status(201).json({
        comment,
        count
      });
    } catch (error) {
      console.error('[PublicScriptCommentController] create error:', error);
      if (error.message?.includes('Public script not found')) {
        return res.status(404).json({ error: 'Script not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default publicScriptCommentController;
