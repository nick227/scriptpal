import { describe, expect, it } from '@jest/globals';

import { normalizeUsername, validateUsername } from '../../lib/username.js';

describe('username utils', () => {
  it('normalizes username by trimming and lowercasing', () => {
    expect(normalizeUsername('  Nick_Name  ')).toBe('nick_name');
  });

  it('rejects invalid characters', () => {
    const result = validateUsername('bad-name');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/only lowercase letters, numbers, and underscores/i);
  });

  it('accepts valid username', () => {
    const result = validateUsername('writer_123');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('writer_123');
  });

  it('rejects reserved usernames', () => {
    const result = validateUsername('profile');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reserved/i);
  });
});
