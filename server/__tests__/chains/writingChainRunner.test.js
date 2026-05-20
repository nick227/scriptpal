import { describe, expect, it } from '@jest/globals';
import { buildWritingOutput } from '../../controllers/langchain/chains/helpers/writingChainRunner.js';
import { INTENT_TYPES } from '../../controllers/langchain/constants.js';

describe('writingChainRunner', () => {
  it('buildWritingOutput keeps script out of message', () => {
    const lines = [
      '<header>INT. ROOM - DAY</header>',
      '<action>She enters.</action>',
      '<speaker>ANN</speaker>',
      '<dialog>Hi.</dialog>',
      '<speaker>BOB</speaker>'
    ];
    const script = lines.join('\n');
    const result = buildWritingOutput({
      contractKey: INTENT_TYPES.NEXT_FIVE_LINES,
      type: INTENT_TYPES.NEXT_FIVE_LINES,
      assistantMessage: script,
      formattedScript: script,
      metadata: {}
    });

    expect(result.script).toBe(script);
    expect(result.message).not.toMatch(/<speaker>/);
  });
});
