import OpenAI from 'openai';
import config from '../../config/index.js';

export class MediaGenerationService {
  constructor() {
    const apiKey = config.get('OPENAI_API_KEY');
    this.client = new OpenAI({ apiKey });
    this.model = config.get('OPENAI_IMAGE_MODEL');
  }

  async generateImage({ prompt, size = '1024x1024' }) {
    const response = await this.client.images.generate({
      model: this.model,
      prompt,
      size
    });

    const payload = response && response.data && response.data[0] ? response.data[0] : null;
    if (!payload) {
      throw new Error('Image generation failed');
    }

    if (payload.b64_json) {
      return {
        buffer: Buffer.from(payload.b64_json, 'base64'),
        mimeType: 'image/png'
      };
    }

    if (payload.url) {
      const fetchResponse = await fetch(payload.url);
      if (!fetchResponse.ok) {
        throw new Error('Failed to fetch generated image');
      }
      const arrayBuffer = await fetchResponse.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: fetchResponse.headers.get('content-type') || 'image/png'
      };
    }

    throw new Error('Image generation returned no data');
  }
}

export default MediaGenerationService;
