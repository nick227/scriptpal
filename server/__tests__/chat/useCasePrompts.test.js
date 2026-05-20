import { describe, expect, it } from '@jest/globals';
import { resolveOutcome } from '../../controllers/chat/intent/resolveOutcome.js';
import { CHAT_OUTCOME, EDITOR_OPERATION } from '../../controllers/chat/intent/outcomes.js';

const baseContext = { scriptId: 42 };

describe('use-case prompt routing', () => {
  it('routes scene-list script writing to WRITE_FROM_SCENES', () => {
    for (const prompt of [
      'Use the current scenes to write our or complete the script.',
      'Start writing the script from the scene list'
    ]) {
      const result = resolveOutcome(prompt, baseContext);
      expect(result.outcome).toBe(CHAT_OUTCOME.WRITE_FROM_SCENES);
      expect(result.editorOperation).toBe(EDITOR_OPERATION.APPEND);
      expect(result.attachScenes).toBe(true);
    }
  });

  it('routes plan gap questions to DISCUSS_SCENES without collections', () => {
    const result = resolveOutcome('Are we missing any scenes in script from the plan?', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.DISCUSS_SCENES);
    expect(result.generateCollections).toEqual([]);
    expect(result.editorOperation).toBeNull();
  });

  it('routes add characters to GENERATE_COLLECTIONS', () => {
    const result = resolveOutcome(
      'Add two new character Bob and Jane to our character list',
      baseContext
    );
    expect(result.outcome).toBe(CHAT_OUTCOME.GENERATE_COLLECTIONS);
    expect(result.generateCollections).toContain('characters');
    expect(result.editorOperation).toBeNull();
  });

  it('routes add scene outline to GENERATE_COLLECTIONS not screenplay append', () => {
    const result = resolveOutcome('Add a scene about Jessica', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.GENERATE_COLLECTIONS);
    expect(result.generateCollections).toContain('scenes');
    expect(result.editorOperation).toBeNull();
  });

  it('routes write a scene to WRITE_SCENE screenplay append', () => {
    const result = resolveOutcome('Write a scene about Jessica', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.WRITE_SCENE);
    expect(result.editorOperation).toBe(EDITOR_OPERATION.APPEND);
    expect(result.attachScenes).toBe(true);
  });
});
