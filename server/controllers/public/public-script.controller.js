import scriptModel from '../../models/script.js';
import { serializePublicScript, serializePublicScriptListItem } from '../../serializers/publicScriptSerializer.js';
import mediaAttachmentRepository from '../../repositories/mediaAttachmentRepository.js';

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

      const scripts = result.scripts || [];
      const scriptIds = scripts.map(script => script.id).filter(Boolean);
      const coverAttachments = await mediaAttachmentRepository.listByOwnerIdsPublic({
        ownerType: 'script',
        ownerIds: scriptIds,
        role: 'cover'
      });
      const coverMap = new Map();
      coverAttachments.forEach(attachment => {
        if (attachment && attachment.ownerId) {
          coverMap.set(attachment.ownerId, attachment);
        }
      });

      const serializedScripts = scripts
        .map((script) => ({
          ...script,
          coverAttachment: coverMap.get(script.id) || null
        }))
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
      const attachments = await mediaAttachmentRepository.listByOwnerIdsPublic({
        ownerType: 'script',
        ownerIds: [script.id],
        role: 'cover'
      });
      const serialized = serializePublicScript({
        ...script,
        coverAttachment: attachments[0] || null
      });
      res.json(serialized);
    } catch (error) {
      console.error('Error fetching public script:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getBySlug: async(req, res) => {
    try {
      const script = await scriptModel.getPublicScriptBySlug(req.params.slug);
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const attachments = await mediaAttachmentRepository.listByOwnerIdsPublic({
        ownerType: 'script',
        ownerIds: [script.id],
        role: 'cover'
      });
      const serialized = serializePublicScript({
        ...script,
        coverAttachment: attachments[0] || null
      });
      res.json(serialized);
    } catch (error) {
      console.error('Error fetching public script by slug:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default publicScriptController;
