import { parseNumericId } from '../utils/idUtils.js';
import mediaAttachmentRepository from '../repositories/mediaAttachmentRepository.js';
import { ensureOwnerExists } from '../services/media/MediaOwnerService.js';

const allowedOwnerTypes = new Set(['script', 'scene', 'character', 'location', 'theme']);
const allowedRoles = new Set(['cover', 'inline', 'gallery', 'reference']);

const mediaOwnerMediaController = async(req, res) => {
  try {
    const { ownerType, ownerId } = req.params;
    if (!ownerType || !allowedOwnerTypes.has(ownerType)) {
      return res.status(400).json({ error: 'Invalid owner type' });
    }

    const parsedOwnerId = parseNumericId(ownerId);
    if (!parsedOwnerId) {
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    const role = req.query && req.query.role ? req.query.role : null;
    if (role && !allowedRoles.has(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const ownerExists = await ensureOwnerExists({
      ownerType,
      ownerId: parsedOwnerId,
      userId: req.userId
    });
    if (!ownerExists) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    const attachments = await mediaAttachmentRepository.listByOwner({
      userId: req.userId,
      ownerType,
      ownerId: parsedOwnerId,
      role: role || undefined
    });

    res.json({ attachments });
  } catch (error) {
    console.error('Error fetching owner media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default mediaOwnerMediaController;
