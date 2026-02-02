/**
 * Tests for media controllers
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

let mockIngest;
let mockGenerateImage;
let mockDeleteObject;

jest.mock('../../repositories/mediaAssetRepository.js', () => ({
  create: jest.fn(),
  updateById: jest.fn(),
  getByIdForUser: jest.fn(),
  listByUser: jest.fn()
}));

jest.mock('../../repositories/mediaVariantRepository.js', () => ({
  createMany: jest.fn(),
  listByAssetId: jest.fn()
}));

jest.mock('../../repositories/mediaAttachmentRepository.js', () => ({
  create: jest.fn(),
  listByOwner: jest.fn()
}));

jest.mock('../../repositories/mediaJobRepository.js', () => ({
  create: jest.fn(),
  updateById: jest.fn(),
  getByIdForUser: jest.fn()
}));

jest.mock('../../services/media/MediaIngestService.js', () => {
  mockIngest = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      ingest: mockIngest
    }))
  };
});

jest.mock('../../services/media/MediaGenerationService.js', () => {
  mockGenerateImage = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      generateImage: mockGenerateImage
    }))
  };
});

jest.mock('../../services/media/MediaOwnerService.js', () => ({
  ensureOwnerExists: jest.fn()
}));

jest.mock('../../services/media/storage/index.js', () => {
  mockDeleteObject = jest.fn();
  return {
    createOriginStorageAdapter: jest.fn().mockReturnValue({
      deleteObject: mockDeleteObject
    })
  };
});

describe('Media Controllers', () => {
  let mediaUploadController;
  let mediaLibraryController;
  let mediaAttachmentController;
  let mediaDeleteController;
  let mediaGenerationController;
  let mediaJobController;
  let mediaOwnerMediaController;
  let mediaAssetRepository;
  let mediaVariantRepository;
  let mediaAttachmentRepository;
  let mediaJobRepository;
  let ownerService;
  let mockRequest;
  let mockResponse;

  beforeEach(async() => {
    jest.clearAllMocks();

    mediaUploadController = (await import('../../controllers/mediaUploadController.js')).default;
    mediaLibraryController = (await import('../../controllers/mediaLibraryController.js')).default;
    mediaAttachmentController = (await import('../../controllers/mediaAttachmentController.js')).default;
    mediaDeleteController = (await import('../../controllers/mediaDeleteController.js')).default;
    mediaGenerationController = (await import('../../controllers/mediaGenerationController.js')).default;
    mediaJobController = (await import('../../controllers/mediaJobController.js')).default;
    mediaOwnerMediaController = (await import('../../controllers/mediaOwnerMediaController.js')).default;

    mediaAssetRepository = await import('../../repositories/mediaAssetRepository.js');
    mediaVariantRepository = await import('../../repositories/mediaVariantRepository.js');
    mediaAttachmentRepository = await import('../../repositories/mediaAttachmentRepository.js');
    mediaJobRepository = await import('../../repositories/mediaJobRepository.js');
    ownerService = await import('../../services/media/MediaOwnerService.js');

    mockRequest = global.testUtils.mockRequest({ userId: 12 });
    mockResponse = global.testUtils.mockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('mediaUploadController', () => {
    it('returns 400 when type is invalid', async() => {
      mockRequest.body = { type: 'audio' };

      await mediaUploadController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid media type' });
    });

    it('returns 400 when file is missing', async() => {
      mockRequest.body = { type: 'image' };

      await mediaUploadController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'File is required' });
    });

    it('ingests and returns media on success', async() => {
      mockRequest.body = { type: 'image' };
      mockRequest.file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        originalname: 'test.png'
      };

      const ingestResult = { asset: { id: 1 }, variants: [] };
      mockIngest.mockResolvedValue(ingestResult);

      await mediaUploadController(mockRequest, mockResponse);

      expect(mockIngest).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(ingestResult);
    });
  });

  describe('mediaLibraryController', () => {
    it('returns 400 for invalid type', async() => {
      mockRequest.query = { type: 'audio' };

      await mediaLibraryController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid media type' });
    });

    it('returns media list for user', async() => {
      mockRequest.query = { type: 'image', page: '1', pageSize: '10' };
      const listResult = { assets: [], total: 0, page: 1, pageSize: 10 };
      mediaAssetRepository.listByUser.mockResolvedValue(listResult);

      await mediaLibraryController(mockRequest, mockResponse);

      expect(mediaAssetRepository.listByUser).toHaveBeenCalledWith({
        userId: 12,
        type: 'image',
        page: 1,
        pageSize: 10
      });
      expect(mockResponse.json).toHaveBeenCalledWith(listResult);
    });
  });

  describe('mediaAttachmentController', () => {
    it('returns 404 when asset not found', async() => {
      mockRequest.params = { id: '99' };
      mockRequest.body = { ownerType: 'script', ownerId: '2', role: 'cover' };
      mediaAssetRepository.getByIdForUser.mockResolvedValue(null);

      await mediaAttachmentController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Asset not found' });
    });

    it('returns 404 when owner not found', async() => {
      mockRequest.params = { id: '9' };
      mockRequest.body = { ownerType: 'script', ownerId: '2', role: 'cover' };
      mediaAssetRepository.getByIdForUser.mockResolvedValue({ id: 9 });
      ownerService.ensureOwnerExists.mockResolvedValue(false);

      await mediaAttachmentController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Owner not found' });
    });

    it('creates attachment on success', async() => {
      mockRequest.params = { id: '9' };
      mockRequest.body = { ownerType: 'script', ownerId: '2', role: 'cover' };
      mediaAssetRepository.getByIdForUser.mockResolvedValue({ id: 9 });
      ownerService.ensureOwnerExists.mockResolvedValue(true);
      mediaAttachmentRepository.create.mockResolvedValue({ id: 55 });

      await mediaAttachmentController(mockRequest, mockResponse);

      expect(mediaAttachmentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        assetId: 9,
        userId: 12,
        ownerType: 'script',
        ownerId: 2,
        role: 'cover'
      }));
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe('mediaDeleteController', () => {
    it('returns 404 when asset not found', async() => {
      mockRequest.params = { id: '12' };
      mediaAssetRepository.getByIdForUser.mockResolvedValue(null);

      await mediaDeleteController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Asset not found' });
    });

    it('deletes variants and marks asset deleted', async() => {
      mockRequest.params = { id: '12' };
      mediaAssetRepository.getByIdForUser.mockResolvedValue({ id: 12, storageKey: 'a/b/c.png' });
      mediaVariantRepository.listByAssetId.mockResolvedValue([{ storageKey: 'a/b/thumb.png' }]);

      await mediaDeleteController(mockRequest, mockResponse);

      expect(mockDeleteObject).toHaveBeenCalledTimes(2);
      expect(mediaAssetRepository.updateById).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(204);
    });
  });

  describe('mediaGenerationController', () => {
    it('returns 400 when prompt is missing', async() => {
      mockRequest.body = { type: 'image' };

      await mediaGenerationController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Prompt is required' });
    });

    it('creates job and starts generation', async() => {
      mockRequest.body = { type: 'image', prompt: 'a test image' };
      mediaJobRepository.create.mockResolvedValue({ id: 33 });
      mockGenerateImage.mockResolvedValue({ buffer: Buffer.from('img'), mimeType: 'image/png' });
      mockIngest.mockResolvedValue({ asset: { id: 44 } });

      await mediaGenerationController(mockRequest, mockResponse);

      expect(mediaJobRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 12,
        type: 'image',
        status: 'queued',
        prompt: 'a test image'
      }));
      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });
  });

  describe('mediaJobController', () => {
    it('returns 404 when job not found', async() => {
      mockRequest.params = { id: '77' };
      mediaJobRepository.getByIdForUser.mockResolvedValue(null);

      await mediaJobController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Job not found' });
    });

    it('returns job for user', async() => {
      mockRequest.params = { id: '77' };
      const job = { id: 77, status: 'queued' };
      mediaJobRepository.getByIdForUser.mockResolvedValue(job);

      await mediaJobController(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(job);
    });
  });

  describe('mediaOwnerMediaController', () => {
    it('returns 400 when owner type is invalid', async() => {
      mockRequest.params = { ownerType: 'bad', ownerId: '1' };

      await mediaOwnerMediaController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid owner type' });
    });

    it('returns 404 when owner not found', async() => {
      mockRequest.params = { ownerType: 'script', ownerId: '1' };
      ownerService.ensureOwnerExists.mockResolvedValue(false);

      await mediaOwnerMediaController(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Owner not found' });
    });

    it('returns attachments for owner', async() => {
      mockRequest.params = { ownerType: 'script', ownerId: '1' };
      ownerService.ensureOwnerExists.mockResolvedValue(true);
      mediaAttachmentRepository.listByOwner.mockResolvedValue([{ id: 1 }]);

      await mediaOwnerMediaController(mockRequest, mockResponse);

      expect(mediaAttachmentRepository.listByOwner).toHaveBeenCalledWith({
        userId: 12,
        ownerType: 'script',
        ownerId: 1,
        role: undefined
      });
      expect(mockResponse.json).toHaveBeenCalledWith({ attachments: [{ id: 1 }] });
    });
  });
});
