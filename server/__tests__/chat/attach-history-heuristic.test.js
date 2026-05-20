import { describe, expect, it } from '@jest/globals';
import { isAttachHistoryRequest } from '../../controllers/chat/intent/heuristics.js';

describe('isAttachHistoryRequest', () => {
  it('returns false for fresh prompts', () => {
    expect(isAttachHistoryRequest('Write the next five lines')).toBe(false);
  });

  it('returns true for follow-up references', () => {
    expect(isAttachHistoryRequest('Change what you wrote last time')).toBe(true);
    expect(isAttachHistoryRequest('Like you suggested, make it darker')).toBe(true);
  });
});
