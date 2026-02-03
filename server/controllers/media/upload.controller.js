import multer from 'multer';
import MediaIngestService from '../../services/media/MediaIngestService.js';

const upload = multer({ storage: multer.memoryStorage() });
const allowedTypes = new Set(['image', 'video']);

export const mediaUploadMiddleware = upload.single('file');

const mediaUploadController = async(req, res) => {
  try {
    const { type } = req.body;
    if (!type || !allowedTypes.has(type)) {
      return res.status(400).json({ error: 'Invalid media type' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const ingestService = new MediaIngestService();
    const result = await ingestService.ingest({
      userId: req.userId,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      type,
      source: 'upload',
      originalFilename: req.file.originalname
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default mediaUploadController;
