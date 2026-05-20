import { describe, expect, it } from '@jest/globals';
import {
  normalizeWritingResponse,
  sanitizeChatMessage,
  isWritingIntent
} from '../../controllers/langchain/chains/helpers/WritingResponseNormalizer.js';
import { INTENT_TYPES } from '../../controllers/langchain/constants.js';

describe('WritingResponseNormalizer', () => {
  it('never puts screenplay XML in message', () => {
    const script = '<speaker>JOHN</speaker>\n<dialog>Hello.</dialog>';
    const result = normalizeWritingResponse({
      assistantMessage: script,
      formattedScript: script
    });

    expect(result.script).toBe(script);
    expect(result.message).not.toMatch(/<speaker>/);
    expect(result.message).toContain('Added');
  });

  it('keeps short assistant confirmation when valid', () => {
    const script = '<speaker>JANE</speaker>\n<dialog>Hi.</dialog>';
    const result = normalizeWritingResponse({
      assistantMessage: 'Continued the scene after the reveal.',
      formattedScript: script
    });

    expect(result.message).toBe('Continued the scene after the reveal.');
    expect(result.script).toBe(script);
  });

  it('sanitizeChatMessage caps long text', () => {
    const long = 'a'.repeat(300);
    const msg = sanitizeChatMessage(long, '');
    expect(msg.length).toBeLessThanOrEqual(240);
  });

  it('isWritingIntent recognizes mutation intents', () => {
    expect(isWritingIntent(INTENT_TYPES.NEXT_FIVE_LINES)).toBe(true);
    expect(isWritingIntent(INTENT_TYPES.GENERAL_CONVERSATION)).toBe(false);
  });
});
