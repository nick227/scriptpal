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
app.use(express.json());
app.use((req, _res, next) => {
  req.userId = 7;
  next();
});
app.get('/api/public/scripts/public/:publicId', publicScriptController.getByPublicId);
app.post('/api/public/scripts/public/:publicId/clone', publicScriptController.cloneByPublicId);

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

  it('clones a public script by publicId when authenticated', async() => {
    scriptModel.clonePublicScriptByPublicId.mockResolvedValue({
      id: 91,
      userId: 7,
      title: 'Big Red (Copy)',
      slug: 'big-red-copy',
      versionNumber: 1,
      content: 'line'
    });

    const response = await request(app)
      .post('/api/public/scripts/public/pub-test-id/clone')
      .send({ versionNumber: 3 });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(91);
    expect(scriptModel.clonePublicScriptByPublicId).toHaveBeenCalledWith({
      publicId: 'pub-test-id',
      targetUserId: 7,
      versionNumber: 3
    });
  });

  it('returns 400 for invalid versionNumber during clone', async() => {
    const response = await request(app)
      .post('/api/public/scripts/public/pub-test-id/clone')
      .send({ versionNumber: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('versionNumber');
  });
});
