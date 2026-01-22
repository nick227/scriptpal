import scriptModel from '../models/script.js';

const VALID_FORMATS = new Set([
  'header',
  'action',
  'speaker',
  'dialog',
  'directions',
  'chapter-break',
  'parenthetical',
  'transition'
]);

const tryParseJson = (value) => {
  if (!value || (value[0] !== '{' && value[0] !== '[')) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const isValidStructuredContent = (parsed) => {
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : Array.isArray(parsed) ? parsed : null;
  if (!lines) return false;
  return lines.every(line => {
    const format = line?.format;
    const content = line?.content ?? line?.text ?? '';
    return typeof format === 'string' &&
      VALID_FORMATS.has(format) &&
      typeof content === 'string';
  });
};

const scriptController = {
  getScript: async(req, res) => {
    try {
      const script = await scriptModel.getScript(req.params.id);
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }
      res.json(script);
    } catch (error) {
      console.error('Error getting script:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createScript: async(req, res) => {
    try {
      const { userId, title, status, content, author } = req.body;
      if (!userId || !title) {
        return res.status(400).json({ error: 'User ID and title are required' });
      }
      const script = await scriptModel.createScript({
        userId,
        title,
        author,
        status: status || 'draft',
        content: content || JSON.stringify({
          version: 2,
          lines: []
        })
      });
      res.status(201).json(script);
    } catch (error) {
      console.error('Error creating script:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateScript: async(req, res) => {
    console.log('Update script request received:', {
      id: req.params.id,
      bodyKeys: Object.keys(req.body),
      contentLength: req.body.content ? req.body.content.length : 0
    });

    try {
      const { title, status, content, author } = req.body;

      if (!title) {
        console.warn('Update rejected: missing title');
        return res.status(400).json({ error: 'Title is required' });
      }

      // Allow explicit empty content (used for metadata-only updates)
      if (content === undefined || content === null) {
        console.warn('Update rejected: missing content');
        return res.status(400).json({ error: 'Content is required' });
      }

      if (typeof content !== 'string') {
        console.warn('Update rejected: content must be a string');
        return res.status(400).json({ error: 'Content must be a string' });
      }

      const trimmedContent = content.trim();
      if (trimmedContent.length > 0) {
        const parsed = tryParseJson(trimmedContent);
        if (parsed) {
          if (!isValidStructuredContent(parsed)) {
            console.warn('Update rejected: invalid structured content');
            return res.status(400).json({ error: 'Content must contain valid script lines' });
          }
        } else if (trimmedContent.includes('</')) {
          const tagPattern = /<([\w-]+)>.*?<\/\1>/g;
          const matches = trimmedContent.match(tagPattern);

          if (!matches) {
            console.warn('Update rejected: invalid XML format');
            return res.status(400).json({ error: 'Content must contain valid script elements' });
          }

          const invalidTags = matches
            .map(match => match.match(/<([\w-]+)>/)[1])
            .filter(tag => !VALID_FORMATS.has(tag));

          if (invalidTags.length > 0) {
            console.warn('Update rejected: invalid tags:', invalidTags);
            return res.status(400).json({
              error: `Invalid script elements: ${invalidTags.join(', ')}.`
            });
          }
        } else {
          console.warn('Update rejected: content must be structured');
          return res.status(400).json({
            error: 'Content must be structured JSON or tagged script format'
          });
        }
      }

      console.log('Validation passed, updating script...');

      // Update script in database
      const script = await scriptModel.updateScript(req.params.id, {
        title,
        author,
        content,
        status
      });

      if (!script) {
        console.warn('Update failed: script not found');
        return res.status(404).json({ error: 'Script not found' });
      }

      res.json(script);
    } catch (error) {
      console.error('Error updating script:', error);
      if (error.message === 'Script not found') {
        return res.status(404).json({ error: 'Script not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getAllScriptsByUser: async(req, res) => {
    try {
      const scripts = await scriptModel.getAllScriptsByUser(req.query.userId);
      res.json(scripts);
    } catch (error) {
      console.error('Error getting all scripts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getScriptProfile: async(req, res) => {
    try {
      console.log('getScriptProfile');
      const script = await scriptModel.getScriptProfile(req.params.id);
      res.json(script);
    } catch (error) {
      console.error('Error getting script profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getScriptStats: async(req, res) => {
    try {
      const stats = await scriptModel.getScriptStats(req.params.id);
      res.json(stats);


    } catch (error) {
      console.error('Error getting script stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteScript: async(req, res) => {
    try {
      const scriptId = Number(req.params.id);
      if (!scriptId) {
        return res.status(400).json({ error: 'Invalid script ID' });
      }

      const deleted = await scriptModel.deleteScript(scriptId);
      if (!deleted) {
        return res.status(404).json({ error: 'Script not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting script:', error);
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Script not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default scriptController;
