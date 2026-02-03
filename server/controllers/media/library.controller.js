import mediaAssetRepository from '../../repositories/mediaAssetRepository.js';

const allowedTypes = new Set(['image', 'video']);

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const mediaLibraryController = async(req, res) => {
  try {
    const { type, page, pageSize } = req.query;
    if (type && !allowedTypes.has(type)) {
      return res.status(400).json({ error: 'Invalid media type' });
    }

    const parsedPage = page ? parsePositiveInt(page) : 1;
    const parsedPageSize = pageSize ? parsePositiveInt(pageSize) : 20;

    if (!parsedPage || !parsedPageSize) {
      return res.status(400).json({ error: 'Invalid pagination' });
    }

    const results = await mediaAssetRepository.listByUser({
      userId: req.userId,
      type,
      page: parsedPage,
      pageSize: parsedPageSize
    });

    res.json(results);
  } catch (error) {
    console.error('Error listing media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default mediaLibraryController;
