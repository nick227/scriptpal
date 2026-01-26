import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const babelConfigPath = resolve(currentDir, 'babel.config.cjs');

export default {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Transform files using Babel for ES modules
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: babelConfigPath }]
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Module name mapping for ES modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1',
    '^@core/(.*)$': '<rootDir>/js/core/$1',
    '^@widgets/(.*)$': '<rootDir>/js/widgets/$1',
    '^@services/(.*)$': '<rootDir>/js/services/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.test.js',
    '!js/**/*.spec.js',
    '!js/__tests__/**',
    '!js/node_modules/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Test timeout
  testTimeout: 10000,
  
  // Worker configuration to prevent crashes
  maxWorkers: 1,
  workerIdleMemoryLimit: '512MB',
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/public/js/__tests__/requirements/',
    '/public/js/__tests__/widgets/editor/',
    '/public/js/__tests__/widgets/auth/'
  ],
  
  // Module directories
  moduleDirectories: ['node_modules', 'js'],
  
  // Global variables
  globals: {
    'process.env.NODE_ENV': 'test'
  }
};
