import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { SceneWriteOrchestrator } from '../../controllers/chat/orchestrator/SceneWriteOrchestrator.js';
import { WriteSceneChain } from '../../controllers/langchain/chains/script/WriteSceneChain.js';
import { getSceneOutline } from '../../controllers/chat/context/sceneOutline.js';

jest.mock('../../controllers/langchain/chains/script/WriteSceneChain.js');
jest.mock('../../controllers/chat/context/sceneOutline.js');

describe('SceneWriteOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns short message when outline has no scenes', async () => {
    getSceneOutline.mockResolvedValue([]);
    const orchestrator = new SceneWriteOrchestrator({ scriptId: 1 });
    const result = await orchestrator.run({ scriptContent: '' }, 'Write all scenes');

    expect(result.message).toMatch(/outline/i);
    expect(result.script).toBeNull();
    expect(result.metadata.scenesWritten).toBe(0);
    expect(WriteSceneChain).not.toHaveBeenCalled();
  });

  it('aggregates scene chunks into one script with short summary message', async () => {
    getSceneOutline.mockResolvedValue([
      { sortIndex: 1, title: 'Opening' },
      { sortIndex: 2, title: 'Twist' }
    ]);

    const run = jest.fn()
      .mockResolvedValueOnce({
        message: 'Scene 1 ready.',
        script: '<header>INT. ROOM</header>\n<action>She enters.</action>'
      })
      .mockResolvedValueOnce({
        message: 'Scene 2 ready.',
        script: '<speaker>ANN</speaker>\n<dialog>Hi.</dialog>'
      });

    WriteSceneChain.mockImplementation(() => ({ run }));

    const orchestrator = new SceneWriteOrchestrator({ scriptId: 5, maxScenes: 10 });
    const result = await orchestrator.run({ scriptContent: '' }, 'Generate script from my scenes');

    expect(run).toHaveBeenCalledTimes(2);
    expect(result.script).toContain('<header>INT. ROOM</header>');
    expect(result.script).toContain('<speaker>ANN</speaker>');
    expect(result.message).toMatch(/Added 2 scenes/);
    expect(result.message).not.toContain('<speaker>');
    expect(result.metadata.scenesWritten).toBe(2);
  });
});
