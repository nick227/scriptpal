/**
 * Tests for user controller
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the user model
jest.mock('../../../models/user.js', () => ({
  getUser: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  validateSession: jest.fn()
}));

describe('UserController', () => {
  let userController;
  let userModel;
  let mockRequest;
  let mockResponse;
  let _mockNext;

  beforeEach(async() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Import the controller after mocking
    userModel = await import('../../../models/user.js');
    userController = await import('../../../controllers/userController.js');

    // Setup mock request/response
    mockRequest = global.testUtils.mockRequest();
    mockResponse = global.testUtils.mockResponse();
    _mockNext = global.testUtils.mockNext();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getUser', () => {
    it('should return user when found', async() => {
      const mockUser = global.testUtils.createTestUser();
      userModel.getUser.mockResolvedValue(mockUser);
      mockRequest.params = { id: '1' };

      await userController.default.getUser(mockRequest, mockResponse);

      expect(userModel.getUser).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 404 when user not found', async() => {
      userModel.getUser.mockResolvedValue(null);
      mockRequest.params = { id: '999' };

      await userController.default.getUser(mockRequest, mockResponse);

      expect(userModel.getUser).toHaveBeenCalledWith('999');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should return 500 on database error', async() => {
      const error = new Error('Database connection failed');
      userModel.getUser.mockRejectedValue(error);
      mockRequest.params = { id: '1' };

      await userController.default.getUser(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('createUser', () => {
    it('should create user with valid email', async() => {
      const mockUser = global.testUtils.createTestUser();
      userModel.createUser.mockResolvedValue(mockUser);
      mockRequest.body = { email: 'test@example.com' };

      await userController.default.createUser(mockRequest, mockResponse);

      expect(userModel.createUser).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it('should return 400 when email is missing', async() => {
      mockRequest.body = {};

      await userController.default.createUser(mockRequest, mockResponse);

      expect(userModel.createUser).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Email is required' });
    });

    it('should return 409 when email already exists', async() => {
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      userModel.createUser.mockRejectedValue(error);
      mockRequest.body = { email: 'existing@example.com' };

      await userController.default.createUser(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Email already exists' });
    });

    it('should return 500 on other database errors', async() => {
      const error = new Error('Database error');
      userModel.createUser.mockRejectedValue(error);
      mockRequest.body = { email: 'test@example.com' };

      await userController.default.createUser(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('updateUser', () => {
    it('should update user with valid data', async() => {
      const mockUser = global.testUtils.createTestUser({ email: 'updated@example.com' });
      userModel.updateUser.mockResolvedValue(mockUser);
      mockRequest.params = { id: '1' };
      mockRequest.body = { email: 'updated@example.com' };

      await userController.default.updateUser(mockRequest, mockResponse);

      expect(userModel.updateUser).toHaveBeenCalledWith('1', { email: 'updated@example.com' });
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it('should return 400 when email is missing', async() => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {};

      await userController.default.updateUser(mockRequest, mockResponse);

      expect(userModel.updateUser).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Email is required' });
    });

    it('should return 404 when user not found', async() => {
      userModel.updateUser.mockResolvedValue(null);
      mockRequest.params = { id: '999' };
      mockRequest.body = { email: 'test@example.com' };

      await userController.default.updateUser(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not found' });
    });
  });

  describe('login', () => {
    it('should login user with valid email', async() => {
      const mockUser = global.testUtils.createTestUser();
      mockUser.sessionToken = 'mock-session-token';
      userModel.login.mockResolvedValue(mockUser);
      mockRequest.body = { email: 'test@example.com' };

      await userController.default.login(mockRequest, mockResponse);

      expect(userModel.login).toHaveBeenCalledWith('test@example.com');
      expect(mockResponse.cookie).toHaveBeenCalledWith('sessionToken', 'mock-session-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      expect(mockResponse.json).toHaveBeenCalledWith({ user: expect.objectContaining({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email
      }) });
    });

    it('should return 400 when email is missing', async() => {
      mockRequest.body = {};

      await userController.default.login(mockRequest, mockResponse);

      expect(userModel.login).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Email is required' });
    });

    it('should return 401 when credentials are invalid', async() => {
      userModel.login.mockResolvedValue(null);
      mockRequest.body = { email: 'invalid@example.com' };

      await userController.default.login(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });
  });

  describe('logout', () => {
    it('should logout user with valid session', async() => {
      userModel.logout.mockResolvedValue(true);
      mockRequest.cookies = { sessionToken: 'valid-session-token' };

      await userController.default.logout(mockRequest, mockResponse);

      expect(userModel.logout).toHaveBeenCalledWith('valid-session-token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('sessionToken');
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });

    it('should return 401 when no session token', async() => {
      mockRequest.cookies = {};

      await userController.default.logout(mockRequest, mockResponse);

      expect(userModel.logout).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    it('should return 401 when session is invalid', async() => {
      userModel.logout.mockResolvedValue(false);
      mockRequest.cookies = { sessionToken: 'invalid-session-token' };

      await userController.default.logout(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid session' });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user with valid session', async() => {
      const mockUser = global.testUtils.createTestUser();
      userModel.validateSession.mockResolvedValue(mockUser);
      mockRequest.cookies = { sessionToken: 'valid-session-token' };

      await userController.default.getCurrentUser(mockRequest, mockResponse);

      expect(userModel.validateSession).toHaveBeenCalledWith('valid-session-token');
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it('should return 401 when no session token', async() => {
      mockRequest.cookies = {};

      await userController.default.getCurrentUser(mockRequest, mockResponse);

      expect(userModel.validateSession).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    it('should return 401 when session is invalid', async() => {
      userModel.validateSession.mockResolvedValue(null);
      mockRequest.cookies = { sessionToken: 'invalid-session-token' };

      await userController.default.getCurrentUser(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid session' });
    });
  });
});
