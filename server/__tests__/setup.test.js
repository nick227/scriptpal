/**
 * Test to verify Jest setup is working correctly
 */

import { describe, it, expect } from '@jest/globals';

describe('Jest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have test utilities available', () => {
    expect(global.testUtils).toBeDefined();
    expect(global.testUtils.mockRequest).toBeDefined();
    expect(global.testUtils.mockResponse).toBeDefined();
    expect(global.testUtils.mockNext).toBeDefined();
  });

  it('should have environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.PORT).toBe('3001');
  });

  it('should handle async operations', async() => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
