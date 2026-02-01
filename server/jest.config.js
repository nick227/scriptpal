/** @type {import('jest').Config} */
const isCi = process.env.CI === 'true';

export default {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/config/'
  ],

  // Coverage configuration
  collectCoverage: isCi,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/jest.config.js',
    '!**/package*.json',
    '!**/README*.md',
    '!**/schema.sql',
    '!**/scriptpal.sql'
  ],

  // Coverage thresholds
  coverageThreshold: isCi ? {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  } : undefined,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/config/setup.js'],

  // Transform configuration for ES modules
  transform: {
    '^.+\\.js$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
    }]
  },

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
};
