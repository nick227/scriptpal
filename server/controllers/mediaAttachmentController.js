import { parseNumericId, parseSortIndex } from '../utils/idUtils.js';
import mediaAssetRepository from '../repositories/mediaAssetRepository.js';
import mediaAttachmentRepository from '../repositories/mediaAttachmentRepository.js';
import { ensureOwnerExists } from '../services/media/MediaOwnerService.js';

const allowedOwnerTypes = new Set(['script', 'scene', 'character', 'location', 'theme']);
const allowedRoles = new Set(['cover', 'inline', 'gallery', 'reference']);

const mediaAttachmentController = async(req, res) => {
  try {
    const assetId = parseNumericId(req.params.id);
    if (!assetId) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const { ownerType, ownerId, role, sortOrder, meta } = req.body;
    if (!ownerType || !allowedOwnerTypes.has(ownerType)) {
      return res.status(400).json({ error: 'Invalid owner type' });
    }
    if (!role || !allowedRoles.has(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const parsedOwnerId = parseNumericId(ownerId);
    if (!parsedOwnerId) {
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    const asset = await mediaAssetRepository.getByIdForUser(assetId, req.userId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const ownerExists = await ensureOwnerExists({
      ownerType,
      ownerId: parsedOwnerId,
      userId: req.userId
    });
    if (!ownerExists) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    const data = {
      assetId,
      userId: req.userId,
      ownerType,
      ownerId: parsedOwnerId,
      role,
      meta
    };

    if (sortOrder !== undefined) {
      const parsedSortOrder = parseSortIndex(sortOrder);
      if (parsedSortOrder === null) {
        return res.status(400).json({ error: 'Invalid sort order' });
      }
      data.sortOrder = parsedSortOrder;
    }

    const attachment = await mediaAttachmentRepository.upsertForOwnerRole(data);
    res.status(201).json(attachment);
  } catch (error) {
    console.error('Error attaching media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default mediaAttachmentController;
