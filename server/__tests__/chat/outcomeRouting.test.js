import { describe, expect, it } from '@jest/globals';
import { outcomeToIntent, resolveResponseIntent } from '../../controllers/chat/intent/outcomeRouting.js';
import { CHAT_OUTCOME } from '../../controllers/chat/intent/outcomes.js';
import { INTENT_TYPES } from '../../controllers/langchain/constants.js';
import { APPEND_SCRIPT_INTENT } from '../../controllers/script-services/AppendPageService.js';

describe('outcomeRouting', () => {
  it('maps WRITE_SCENE to WriteScene chain intent', () => {
    expect(outcomeToIntent(CHAT_OUTCOME.WRITE_SCENE)).toBe(INTENT_TYPES.WRITE_SCENE);
  });

  it('maps REWRITE to Rewrite chain intent', () => {
    expect(outcomeToIntent(CHAT_OUTCOME.REWRITE)).toBe(INTENT_TYPES.REWRITE);
  });

  it('exposes WRITE_SCENE to client as append intent', () => {
    const result = resolveResponseIntent(CHAT_OUTCOME.WRITE_SCENE, { intent: INTENT_TYPES.WRITE_SCENE });
    expect(result.intent).toBe(APPEND_SCRIPT_INTENT);
  });

  it('exposes REWRITE to client as REWRITE', () => {
    const result = resolveResponseIntent(CHAT_OUTCOME.REWRITE, { intent: INTENT_TYPES.REWRITE });
    expect(result.intent).toBe(INTENT_TYPES.REWRITE);
  });

  it('keeps DISCUSS_SCENES as discuss intent', () => {
    const result = resolveResponseIntent(CHAT_OUTCOME.DISCUSS_SCENES, { intent: INTENT_TYPES.DISCUSS_SCENES });
    expect(result.intent).toBe(INTENT_TYPES.DISCUSS_SCENES);
  });
});
