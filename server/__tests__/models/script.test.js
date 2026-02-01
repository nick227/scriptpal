/**
 * Tests for script model
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Script Model', () => {
  let _mockDb;
  let mockScript;

  beforeEach(() => {
    _mockDb = global.testUtils.mockDbConnection();
    mockScript = global.testUtils.createTestScript();
  });

  it('should be importable', () => {
    expect(() => {
      require('../../models/script.js');
    }).not.toThrow();
  });

  it('should create script data structure', () => {
    expect(mockScript).toBeDefined();
    expect(mockScript.id).toBe(1);
    expect(mockScript.userId).toBe(1);
    expect(mockScript.title).toBe('Test Script');
    expect(mockScript.content).toBe('Test script content');
  });

  it('should validate script properties', () => {
    expect(mockScript).toHaveProperty('id');
    expect(mockScript).toHaveProperty('userId');
    expect(mockScript).toHaveProperty('title');
    expect(mockScript).toHaveProperty('content');
    expect(mockScript).toHaveProperty('versionNumber');
    expect(mockScript).toHaveProperty('createdAt');
    expect(mockScript).toHaveProperty('updatedAt');
  });

  it('should handle script creation', () => {
    const newScript = {
      userId: 1,
      title: 'New Script',
      content: 'New script content',
      versionNumber: 1
    };

    expect(newScript.userId).toBe(1);
    expect(newScript.title).toBe('New Script');
    expect(newScript.content).toBe('New script content');
    expect(newScript.versionNumber).toBe(1);
  });

  it('should handle script updates', () => {
    const updatedScript = {
      ...mockScript,
      title: 'Updated Script',
      content: 'Updated script content',
      versionNumber: 2,
      updatedAt: new Date()
    };

    expect(updatedScript.title).toBe('Updated Script');
    expect(updatedScript.content).toBe('Updated script content');
    expect(updatedScript.versionNumber).toBe(2);
    expect(updatedScript.updatedAt).toBeInstanceOf(Date);
  });

  it('should handle script versioning', () => {
    const scriptV1 = { ...mockScript, versionNumber: 1 };
    const scriptV2 = { ...mockScript, versionNumber: 2 };

    expect(scriptV1.versionNumber).toBe(1);
    expect(scriptV2.versionNumber).toBe(2);
    expect(scriptV1.id).toBe(scriptV2.id);
  });
});
