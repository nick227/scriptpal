import scriptModel from '../models/script.js';
import {
  serializePublicScript,
  serializePublicScriptListItem
} from '../serializers/publicScriptSerializer.js';

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

const toInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const publicScriptController = {
  list: async(req, res) => {
    try {
      const page = toInteger(req.query.page, 1);
      const pageSize = Math.min(MAX_PAGE_SIZE, toInteger(req.query.pageSize, DEFAULT_PAGE_SIZE));
      const sortBy = req.query.sortBy || 'updatedAt';
      const sortOrder = req.query.order === 'asc' ? 'asc' : 'desc';

      const result = await scriptModel.getPublicScripts({
        page,
        pageSize,
        sortBy,
        sortOrder
      });

      const serializedScripts = (result.scripts || [])
        .map(serializePublicScriptListItem)
        .filter(Boolean);

      res.json({
        scripts: serializedScripts,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / (result.pageSize || 1))
      }
    });
  } catch (error) {
      console.error('Error listing public scripts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  get: async(req, res) => {
    try {
      const script = await scriptModel.getPublicScript(req.params.id);
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const serialized = serializePublicScript(script);
      res.json(serialized);
    } catch (error) {
      console.error('Error fetching public script:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default publicScriptController;
