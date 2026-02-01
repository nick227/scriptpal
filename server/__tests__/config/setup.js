/**
 * Jest setup file for backend tests
 * This file runs before all tests
 */

import { jest } from '@jest/globals';

jest.mock('../../db/prismaClient.js', () => ({
  __esModule: true,
  default: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    chatMessage: {
      findMany: jest.fn(),
      deleteMany: jest.fn()
    },
    scene: {
      findMany: jest.fn().mockResolvedValue([])
    },
    character: {
      findMany: jest.fn().mockResolvedValue([])
    },
    location: {
      findMany: jest.fn().mockResolvedValue([])
    },
    theme: {
      findMany: jest.fn().mockResolvedValue([])
    },
    script: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    session: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn()
    }
  }
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NAME = 'test_scriptpal';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.JWT_SECRET = 'test_jwt_secret';

// Global test utilities
global.testUtils = {
  // Mock database connection
  mockDbConnection: () => {
    return {
      query: jest.fn(),
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };
  },

  // Mock Express request
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),

  // Mock Express response
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
  },

  // Mock Express next function
  mockNext: () => jest.fn(),

  // Create test user data
  createTestUser: (overrides = {}) => ({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Create test script data
  createTestScript: (overrides = {}) => ({
    id: 1,
    userId: 1,
    title: 'Test Script',
    content: 'Test script content',
    versionNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Create test conversation data
  createTestConversation: (overrides = {}) => ({
    id: 1,
    userId: 1,
    title: 'Test Conversation',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
};

// Console suppression for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Restore console after tests
afterAll(() => {
  global.console = originalConsole;
});
