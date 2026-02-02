import { parseNumericId } from '../utils/idUtils.js';
import mediaAssetRepository from '../repositories/mediaAssetRepository.js';
import mediaVariantRepository from '../repositories/mediaVariantRepository.js';
import { createOriginStorageAdapter } from '../services/media/storage/index.js';

const mediaDeleteController = async(req, res) => {
  try {
    const assetId = parseNumericId(req.params.id);
    if (!assetId) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const asset = await mediaAssetRepository.getByIdForUser(assetId, req.userId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const variants = await mediaVariantRepository.listByAssetId(assetId);
    const keys = new Set(variants.map(variant => variant.storageKey));
    if (asset.storageKey) {
      keys.add(asset.storageKey);
    }

    const originAdapter = createOriginStorageAdapter();
    for (const key of keys) {
      await originAdapter.deleteObject({ key });
    }

    await mediaAssetRepository.updateById(assetId, { deletedAt: new Date() });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default mediaDeleteController;
