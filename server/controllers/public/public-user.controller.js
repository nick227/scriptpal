import { normalizeUsername } from '../../lib/username.js';
import userRepository from '../../repositories/userRepository.js';
import { serializePublicScriptListItem } from '../../serializers/publicScriptSerializer.js';

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

const toInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const publicUserController = {
  getByUsername: async(req, res) => {
    try {
      const rawUsername = req.params.username;
      const normalizedUsername = normalizeUsername(rawUsername);
      if (!normalizedUsername) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const page = toInteger(req.query.page, 1);
      const pageSize = Math.min(MAX_PAGE_SIZE, toInteger(req.query.pageSize, DEFAULT_PAGE_SIZE));

      const result = await userRepository.getPublicProfileByUsername(normalizedUsername, {
        page,
        pageSize
      });

      if (!result) {
        return res.status(404).json({ error: 'User not found' });
      }

      const scripts = (result.scripts || [])
        .map((script) => ({
          ...script,
          versionNumber: script.versions?.[0]?.versionNumber || 1
        }))
        .map(serializePublicScriptListItem)
        .filter(Boolean);

      return res.json({
        user: {
          id: result.user.id,
          username: result.user.username
        },
        scripts,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / (result.pageSize || 1))
        }
      });
    } catch (error) {
      console.error('Error fetching public user profile:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default publicUserController;

