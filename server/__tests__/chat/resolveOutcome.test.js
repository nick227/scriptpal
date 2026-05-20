import { describe, expect, it } from '@jest/globals';
import { resolveOutcome } from '../../controllers/chat/intent/resolveOutcome.js';
import { CHAT_OUTCOME, CONTEXT_PROFILE, EDITOR_OPERATION } from '../../controllers/chat/intent/outcomes.js';

const baseContext = { scriptId: 42 };

describe('resolveOutcome', () => {
  it('routes continue writing to WRITE_CONTINUE with script tail', () => {
    const result = resolveOutcome('Please continue the script', baseContext);
    expect(result).toEqual({
      outcome: CHAT_OUTCOME.WRITE_CONTINUE,
      contextProfile: CONTEXT_PROFILE.SCRIPT_TAIL,
      attachHistory: false,
      attachScenes: false,
      editorOperation: EDITOR_OPERATION.APPEND
    });
  });

  it('routes next five lines to WRITE_CONTINUE', () => {
    const result = resolveOutcome('Write the next five lines', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.WRITE_CONTINUE);
    expect(result.editorOperation).toBe(EDITOR_OPERATION.APPEND);
  });

  it('routes structure feedback to DISCUSS_SCRIPT', () => {
    const result = resolveOutcome('Is the opening too slow for the tone I want?', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.DISCUSS_SCRIPT);
    expect(result.contextProfile).toBe(CONTEXT_PROFILE.SCRIPT_TAIL);
    expect(result.editorOperation).toBeNull();
  });

  it('routes scene list questions to DISCUSS_SCENES with scenes outline', () => {
    const result = resolveOutcome('Does scene 2 work in my scene list?', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.DISCUSS_SCENES);
    expect(result.contextProfile).toBe(CONTEXT_PROFILE.SCENES_OUTLINE);
    expect(result.attachScenes).toBe(true);
    expect(result.editorOperation).toBeNull();
  });

  it('routes write scene requests to WRITE_SCENE without implementing generation yet', () => {
    const result = resolveOutcome('Write scene 3 from my outline', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.WRITE_SCENE);
    expect(result.attachScenes).toBe(true);
    expect(result.editorOperation).toBe(EDITOR_OPERATION.APPEND);
  });

  it('sets attachHistory for follow-up prompts', () => {
    const result = resolveOutcome('Change what you wrote last time', baseContext);
    expect(result.attachHistory).toBe(true);
  });

  it('routes selection rewrite to REWRITE', () => {
    const result = resolveOutcome('Rewrite this to be sharper', {
      ...baseContext,
      selection: { text: '<dialog>Hello</dialog>' }
    });
    expect(result.outcome).toBe(CHAT_OUTCOME.REWRITE);
    expect(result.contextProfile).toBe(CONTEXT_PROFILE.SELECTION);
    expect(result.editorOperation).toBe(EDITOR_OPERATION.REPLACE);
  });

  it('uses CHAT_CONTROL when no script is loaded', () => {
    const result = resolveOutcome('Hello there', { scriptId: null });
    expect(result.outcome).toBe(CHAT_OUTCOME.CHAT_CONTROL);
    expect(result.contextProfile).toBe(CONTEXT_PROFILE.MINIMAL);
  });
});
