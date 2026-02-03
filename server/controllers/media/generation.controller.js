import config from '../../config/index.js';
import mediaJobRepository from '../../repositories/mediaJobRepository.js';
import MediaGenerationService from '../../services/media/MediaGenerationService.js';
import MediaIngestService from '../../services/media/MediaIngestService.js';

const mediaGenerationController = async(req, res) => {
  try {
    const { prompt, negativePrompt, params, type } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    if (type !== 'image') {
      return res.status(400).json({ error: 'Only image generation is supported' });
    }

    const job = await mediaJobRepository.create({
      userId: req.userId,
      type,
      status: 'queued',
      prompt,
      negativePrompt,
      params,
      provider: 'openai',
      model: config.get('OPENAI_IMAGE_MODEL')
    });

    req.logger?.info('Media generation queued', {
      jobId: job.id,
      userId: req.userId,
      type
    });

    res.status(202).json(job);

    setImmediate(async() => {
      await mediaJobRepository.updateById(job.id, { status: 'running' });

      try {
        const generationService = new MediaGenerationService();
        const ingestService = new MediaIngestService();
        const result = await generationService.generateImage({ prompt });

        const ingested = await ingestService.ingest({
          userId: req.userId,
          buffer: result.buffer,
          mimeType: result.mimeType,
          type: 'image',
          source: 'ai',
          originalFilename: 'generated.png'
        });

        await mediaJobRepository.updateById(job.id, {
          status: 'succeeded',
          resultAssetId: ingested.asset.id
        });
        req.logger?.info('Media generation succeeded', {
          jobId: job.id,
          userId: req.userId,
          assetId: ingested.asset.id
        });
      } catch (error) {
        req.logger?.error('Media generation failed', {
          jobId: job.id,
          userId: req.userId,
          error: error?.message || String(error)
        });
        await mediaJobRepository.updateById(job.id, {
          status: 'failed',
          error: error && error.message ? error.message : 'Generation failed'
        });
      }
    });
  } catch (error) {
    console.error('Error starting media generation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default mediaGenerationController;
