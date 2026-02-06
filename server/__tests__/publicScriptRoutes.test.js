import express from 'express';
import request from 'supertest';
import publicScriptController from '../controllers/public/public-script.controller.js';
import scriptModel from '../models/script.js';
import mediaAttachmentRepository from '../repositories/mediaAttachmentRepository.js';

jest.mock('../models/script.js');
jest.mock('../repositories/mediaAttachmentRepository.js', () => ({
  listByOwnerIdsPublic: jest.fn()
}));

const app = express();
app.get('/api/public/scripts/public/:publicId', publicScriptController.getByPublicId);

describe('Public script routing', () => {
  beforeEach(() => {
    mediaAttachmentRepository.listByOwnerIdsPublic.mockResolvedValue([]);
  });

  it('returns the public script when the publicId exists', async () => {
    scriptModel.getPublicScriptByPublicId.mockResolvedValue({
      id: 42,
      publicId: 'pub-test-id',
      slug: 'big-red',
      title: 'Big Red',
      visibility: 'public',
      commentCount: 0,
      content: 'line',
      versions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const response = await request(app).get('/api/public/scripts/public/pub-test-id');

    expect(response.status).toBe(200);
    expect(response.body.publicId).toBe('pub-test-id');
    expect(response.body.slug).toBe('big-red');
    expect(response.body.canonicalSlug).toBe('big-red');
  });

  it('returns 404 when the publicId is missing', async () => {
    scriptModel.getPublicScriptByPublicId.mockResolvedValue(null);

    const response = await request(app).get('/api/public/scripts/public/not-found');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Script not found');
  });
});
