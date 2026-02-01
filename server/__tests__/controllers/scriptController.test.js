/**
 * Tests for script controller
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the script model
jest.mock('../../models/script.js', () => ({
  getScript: jest.fn(),
  getScriptBySlug: jest.fn(),
  getScriptProfile: jest.fn(),
  getScriptStats: jest.fn(),
  createScript: jest.fn(),
  updateScript: jest.fn(),
  deleteScript: jest.fn(),
  getAllScriptsByUser: jest.fn()
}));

jest.mock('../../repositories/scriptRepository.js', () => ({
  getById: jest.fn()
}));

describe('ScriptController', () => {
  let scriptController;
  let scriptModel;
  let scriptRepository;
  let mockRequest;
  let mockResponse;
  let _mockNext;

  beforeEach(async() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Import the controller after mocking
    scriptModel = await import('../../models/script.js');
    scriptController = await import('../../controllers/scriptController.js');
    scriptRepository = await import('../../repositories/scriptRepository.js');

    // Setup mock request/response
    mockRequest = global.testUtils.mockRequest();
    mockRequest.userId = 1;
    mockResponse = global.testUtils.mockResponse();
    _mockNext = global.testUtils.mockNext();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getScript', () => {
    it('should return script when found', async() => {
      const mockScript = global.testUtils.createTestScript({ userId: 1 });
      scriptModel.getScript.mockResolvedValue(mockScript);
      mockRequest.params = { id: '1' };

      await scriptController.default.getScript(mockRequest, mockResponse);

      expect(scriptModel.getScript).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith(mockScript);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 404 when script not found', async() => {
      scriptModel.getScript.mockResolvedValue(null);
      mockRequest.params = { id: '999' };

      await scriptController.default.getScript(mockRequest, mockResponse);

      expect(scriptModel.getScript).toHaveBeenCalledWith('999');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Script not found' });
    });

    it('should return 500 on database error', async() => {
      const error = new Error('Database connection failed');
      scriptModel.getScript.mockRejectedValue(error);
      mockRequest.params = { id: '1' };

      await scriptController.default.getScript(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('createScript', () => {
    it('should create script with valid data', async() => {
      const mockScript = global.testUtils.createTestScript();
      scriptModel.createScript.mockResolvedValue(mockScript);
      mockRequest.body = {
        title: 'Test Script',
        status: 'draft',
        content: 'Test content'
      };

      await scriptController.default.createScript(mockRequest, mockResponse);

      expect(scriptModel.createScript).toHaveBeenCalledWith(expect.objectContaining({
        userId: 1,
        title: 'Test Script',
        status: 'draft'
      }));
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockScript);
    });

    it('should create script with default values when optional fields missing', async() => {
      const mockScript = global.testUtils.createTestScript();
      scriptModel.createScript.mockResolvedValue(mockScript);
      mockRequest.body = {
        title: 'Test Script'
      };

      await scriptController.default.createScript(mockRequest, mockResponse);

      expect(scriptModel.createScript).toHaveBeenCalledWith(expect.objectContaining({
        userId: 1,
        title: 'Test Script',
        status: 'draft',
        content: expect.stringContaining('"lines"')
      }));
    });

    it('should return 400 when title is missing', async() => {
      mockRequest.body = {
        status: 'draft'
      };

      await scriptController.default.createScript(mockRequest, mockResponse);

      expect(scriptModel.createScript).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Title is required' });
    });

    it('should return 500 on database error', async() => {
      const error = new Error('Database error');
      scriptModel.createScript.mockRejectedValue(error);
      mockRequest.body = {
        title: 'Test Script'
      };

      await scriptController.default.createScript(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('updateScript', () => {
    it('should update script with valid data', async() => {
      const mockScript = global.testUtils.createTestScript({ title: 'Updated Script' });
      scriptRepository.getById.mockResolvedValue({ id: 1, userId: 1 });
      scriptModel.updateScript.mockResolvedValue(mockScript);
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        title: 'Updated Script',
        content: '<action>Updated content</action>'
      };

      await scriptController.default.updateScript(mockRequest, mockResponse);

      expect(scriptModel.updateScript).toHaveBeenCalledWith('1', {
        title: 'Updated Script',
        author: undefined,
        description: undefined,
        content: '<action>Updated content</action>',
        status: undefined
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockScript);
    });

    it('should return 404 when script not found', async() => {
      scriptRepository.getById.mockResolvedValue(null);
      mockRequest.params = { id: '999' };
      mockRequest.body = { title: 'Updated Script', content: '<action>Updated content</action>' };

      await scriptController.default.updateScript(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Script not found' });
    });

    it('should return 500 on database error', async() => {
      const error = new Error('Database error');
      scriptRepository.getById.mockResolvedValue({ id: 1, userId: 1 });
      scriptModel.updateScript.mockRejectedValue(error);
      mockRequest.params = { id: '1' };
      mockRequest.body = { title: 'Updated Script', content: '<action>Updated content</action>' };

      await scriptController.default.updateScript(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('deleteScript', () => {
    it('should delete script successfully', async() => {
      scriptRepository.getById.mockResolvedValue({ id: 1, userId: 1 });
      scriptModel.deleteScript.mockResolvedValue(true);
      mockRequest.params = { id: '1' };

      await scriptController.default.deleteScript(mockRequest, mockResponse);

      expect(scriptModel.deleteScript).toHaveBeenCalledWith(1);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should return 404 when script not found', async() => {
      scriptRepository.getById.mockResolvedValue(null);
      scriptModel.deleteScript.mockResolvedValue(false);
      mockRequest.params = { id: '999' };

      await scriptController.default.deleteScript(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Script not found' });
    });

    it('should return 500 on database error', async() => {
      const error = new Error('Database error');
      scriptRepository.getById.mockResolvedValue({ id: 1, userId: 1 });
      scriptModel.deleteScript.mockRejectedValue(error);
      mockRequest.params = { id: '1' };

      await scriptController.default.deleteScript(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('getAllScriptsByUser', () => {
    it('should return user scripts', async() => {
      const mockScripts = [
        global.testUtils.createTestScript({ id: 1, title: 'Script 1' }),
        global.testUtils.createTestScript({ id: 2, title: 'Script 2' })
      ];
      scriptModel.getAllScriptsByUser.mockResolvedValue(mockScripts);
      mockRequest.query = { userId: '1' };

      await scriptController.default.getAllScriptsByUser(mockRequest, mockResponse);

      expect(scriptModel.getAllScriptsByUser).toHaveBeenCalledWith(1);
      expect(mockResponse.json).toHaveBeenCalledWith(mockScripts);
    });

    it('should return empty array when no scripts found', async() => {
      scriptModel.getAllScriptsByUser.mockResolvedValue([]);
      mockRequest.query = { userId: '1' };

      await scriptController.default.getAllScriptsByUser(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith([]);
    });

    it('should return 500 on database error', async() => {
      const error = new Error('Database error');
      scriptModel.getAllScriptsByUser.mockRejectedValue(error);
      mockRequest.query = { userId: '1' };

      await scriptController.default.getAllScriptsByUser(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
