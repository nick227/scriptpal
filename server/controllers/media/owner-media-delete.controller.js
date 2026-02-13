import { parseNumericId } from '../../utils/idUtils.js';
import mediaAttachmentRepository from '../../repositories/mediaAttachmentRepository.js';
import { ensureOwnerExists } from '../../services/media/MediaOwnerService.js';

const allowedOwnerTypes = new Set(['script', 'scene', 'character', 'location', 'theme']);

const mediaOwnerMediaDeleteController = async(req, res) => {
  try {
    const { ownerType, ownerId, attachmentId } = req.params;
    if (!ownerType || !allowedOwnerTypes.has(ownerType)) {
      return res.status(400).json({ error: 'Invalid owner type' });
    }

    const parsedOwnerId = parseNumericId(ownerId);
    const parsedAttachmentId = parseNumericId(attachmentId);
    if (!parsedOwnerId || !parsedAttachmentId) {
      return res.status(400).json({ error: 'Invalid owner ID or attachment ID' });
    }

    const ownerExists = await ensureOwnerExists({
      ownerType,
      ownerId: parsedOwnerId,
      userId: req.userId
    });
    if (!ownerExists) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    const result = await mediaAttachmentRepository.deleteByOwnerAttachmentId({
      id: parsedAttachmentId,
      userId: req.userId,
      ownerType,
      ownerId: parsedOwnerId
    });

    if (!result || result.count === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting owner media attachment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default mediaOwnerMediaDeleteController;
