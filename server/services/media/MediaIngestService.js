import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import mediaAssetRepository from '../../repositories/mediaAssetRepository.js';
import mediaVariantRepository from '../../repositories/mediaVariantRepository.js';
import { createOriginStorageAdapter, createDeliveryAdapter } from './storage/index.js';

const IMAGE_VARIANTS = [
  { kind: 'thumb', width: 320, format: 'webp' },
  { kind: 'preview', width: 1024, format: 'webp' }
];

const mimeTypeToExtension = (mimeType) => {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm'
  };
  return map[mimeType] || '';
};

const sanitizeFilename = (value) => {
  if (!value) return null;
  const base = path.basename(value);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const readStreamToBuffer = async(stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export class MediaIngestService {
  constructor({ originAdapter, deliveryAdapter } = {}) {
    this.originAdapter = originAdapter || createOriginStorageAdapter();
    this.deliveryAdapter = deliveryAdapter || createDeliveryAdapter();
    this.storageProvider = this.originAdapter.provider || 'local';
  }

  async ingest({ userId, buffer, stream, mimeType, type, source, originalFilename }) {
    if (!userId || (!buffer && !stream) || !mimeType || !type || !source) {
      throw new Error('Missing required media ingestion fields');
    }

    const payload = buffer || await readStreamToBuffer(stream);
    const checksum = crypto.createHash('sha256').update(payload).digest('hex');
    const extension = mimeTypeToExtension(mimeType);
    const sanitized = sanitizeFilename(originalFilename) || `original${extension}`;

    const asset = await mediaAssetRepository.create({
      userId,
      type,
      status: 'processing',
      visibility: 'private',
      source,
      mimeType,
      storageProvider: this.storageProvider,
      storageKey: 'pending'
    });

    const assetId = asset.id;
    const originalKey = `${userId}/${assetId}/original/${sanitized}`;
    const variants = [];

    try {
      await this.originAdapter.putObject({ key: originalKey, buffer: payload });

      let width = null;
      let height = null;
      if (type === 'image') {
        const metadata = await sharp(payload).metadata();
        width = metadata.width || null;
        height = metadata.height || null;
      }

      variants.push({
        assetId,
        kind: 'original',
        format: extension.replace('.', '') || mimeType,
        width,
        height,
        sizeBytes: payload.length,
        provider: this.storageProvider,
        storageKey: originalKey
      });

      if (type === 'image') {
        for (const spec of IMAGE_VARIANTS) {
          const { data, info } = await sharp(payload)
            .resize({ width: spec.width, withoutEnlargement: true })
            .toFormat(spec.format)
            .toBuffer({ resolveWithObject: true });

          const variantName = `${spec.kind}.${spec.format}`;
          const variantKey = `${userId}/${assetId}/${spec.kind}/${variantName}`;

          await this.originAdapter.putObject({ key: variantKey, buffer: data });

          variants.push({
            assetId,
            kind: spec.kind,
            format: spec.format,
            width: info.width || null,
            height: info.height || null,
            sizeBytes: data.length,
            provider: this.storageProvider,
            storageKey: variantKey
          });
        }
      }

      await mediaVariantRepository.createMany(variants);

      const updated = await mediaAssetRepository.updateById(assetId, {
        storageKey: originalKey,
        checksum,
        sizeBytes: payload.length,
        width,
        height,
        status: 'ready'
      });

      return {
        asset: updated,
        variants
      };
    } catch (error) {
      await mediaAssetRepository.updateById(assetId, { status: 'failed' });
      throw error;
    }
  }
}

export default MediaIngestService;
