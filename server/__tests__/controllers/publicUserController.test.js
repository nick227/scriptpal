import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../repositories/userRepository.js', () => ({
  getPublicProfileByUsername: jest.fn()
}));

jest.mock('../../serializers/publicScriptSerializer.js', () => ({
  serializePublicScriptListItem: jest.fn((value) => value)
}));

describe('publicUserController', () => {
  let controller;
  let userRepository;

  beforeEach(async() => {
    jest.clearAllMocks();
    userRepository = await import('../../repositories/userRepository.js');
    controller = (await import('../../controllers/public/public-user.controller.js')).default;
  });

  it('returns public user profile by normalized username', async() => {
    const req = global.testUtils.mockRequest({
      params: { username: 'Nick_Name' },
      query: {}
    });
    const res = global.testUtils.mockResponse();

    userRepository.getPublicProfileByUsername.mockResolvedValue({
      user: { id: 1, username: 'nick_name' },
      scripts: [{ id: 10, title: 'Public Script', versions: [{ versionNumber: 2 }] }],
      total: 1,
      page: 1,
      pageSize: 12
    });

    await controller.getByUsername(req, res);

    expect(userRepository.getPublicProfileByUsername).toHaveBeenCalledWith('nick_name', expect.any(Object));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      user: { id: 1, username: 'nick_name' },
      scripts: expect.any(Array)
    }));
  });

  it('returns 404 when user not found', async() => {
    const req = global.testUtils.mockRequest({
      params: { username: 'missing_user' },
      query: {}
    });
    const res = global.testUtils.mockResponse();

    userRepository.getPublicProfileByUsername.mockResolvedValue(null);

    await controller.getByUsername(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
