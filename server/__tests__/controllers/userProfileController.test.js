import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../models/user.js', () => ({
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  softDeleteUser: jest.fn(),
  getUser: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn()
}));

jest.mock('../../models/script.js', () => ({
  createScript: jest.fn()
}));

jest.mock('../../repositories/tokenUsageRepository.js', () => ({
  getTotalsForUser: jest.fn()
}));

jest.mock('../../middleware/sessionCache.js', () => ({
  delete: jest.fn(),
  deleteByUserId: jest.fn()
}));

describe('User profile controller endpoints', () => {
  let userController;
  let userModel;

  beforeEach(async() => {
    jest.clearAllMocks();
    userModel = await import('../../models/user.js');
    userController = (await import('../../controllers/user/user.controller.js')).default;
  });

  it('updates current profile username', async() => {
    const req = global.testUtils.mockRequest({
      userId: 1,
      body: { username: 'Writer_One' }
    });
    const res = global.testUtils.mockResponse();

    userModel.updateProfile.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'writer_one',
      usernameNormalized: 'writer_one',
      passwordHash: 'hash',
      passwordSalt: 'salt'
    });

    await userController.updateCurrentProfile(req, res);

    expect(userModel.updateProfile).toHaveBeenCalledWith(1, { username: 'Writer_One' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      email: 'user@example.com',
      username: 'writer_one'
    }));
    expect(res.json.mock.calls[0][0].passwordHash).toBeUndefined();
  });

  it('returns 400 for invalid username payload', async() => {
    const req = global.testUtils.mockRequest({ userId: 1, body: { username: 'bad-name' } });
    const res = global.testUtils.mockResponse();

    const error = new Error('Username may contain only lowercase letters, numbers, and underscores');
    error.code = 'INVALID_USERNAME';
    userModel.updateProfile.mockRejectedValue(error);

    await userController.updateCurrentProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('changes password and clears auth cookie', async() => {
    const req = global.testUtils.mockRequest({
      userId: 1,
      body: { currentPassword: 'old-pass', newPassword: 'new-pass-123' },
      cookies: { sessionToken: 'abc' }
    });
    const res = global.testUtils.mockResponse();

    userModel.changePassword.mockResolvedValue(true);

    await userController.changePassword(req, res);

    expect(userModel.changePassword).toHaveBeenCalledWith(1, {
      currentPassword: 'old-pass',
      newPassword: 'new-pass-123'
    });
    expect(res.clearCookie).toHaveBeenCalledWith('sessionToken', expect.objectContaining({ path: '/' }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 401 when current password is wrong', async() => {
    const req = global.testUtils.mockRequest({
      userId: 1,
      body: { currentPassword: 'wrong', newPassword: 'new-pass-123' }
    });
    const res = global.testUtils.mockResponse();

    const error = new Error('Current password is incorrect');
    error.code = 'INVALID_CURRENT_PASSWORD';
    userModel.changePassword.mockRejectedValue(error);

    await userController.changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('soft deletes current user account', async() => {
    const req = global.testUtils.mockRequest({
      userId: 1,
      body: { password: 'secret', confirm: 'DELETE' },
      cookies: { sessionToken: 'abc' }
    });
    const res = global.testUtils.mockResponse();

    userModel.softDeleteUser.mockResolvedValue(true);

    await userController.softDeleteCurrentUser(req, res);

    expect(userModel.softDeleteUser).toHaveBeenCalledWith(1, {
      password: 'secret',
      deleteReason: undefined
    });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('requires DELETE confirmation text before soft delete', async() => {
    const req = global.testUtils.mockRequest({
      userId: 1,
      body: { password: 'secret', confirm: 'nope' }
    });
    const res = global.testUtils.mockResponse();

    await userController.softDeleteCurrentUser(req, res);

    expect(userModel.softDeleteUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
