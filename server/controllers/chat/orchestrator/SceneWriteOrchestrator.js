import { WriteSceneChain } from '../../langchain/chains/script/WriteSceneChain.js';
import { INTENT_TYPES } from '../../langchain/constants.js';
import { getSceneOutline } from '../context/sceneOutline.js';
import { finalizeWritingResponse } from '../../langchain/chains/helpers/writingChainRunner.js';
import { normalizeWritingResponse } from '../../langchain/chains/helpers/WritingResponseNormalizer.js';

export const MAX_SCENES_PER_REQUEST = 10;

const sortScenes = (scenes) => [...scenes].sort((a, b) => {
  const left = Number(a?.sortIndex) || 0;
  const right = Number(b?.sortIndex) || 0;
  return left - right;
});

const joinScriptChunks = (chunks) => chunks
  .map((chunk) => (typeof chunk === 'string' ? chunk.trim() : ''))
  .filter(Boolean)
  .join('\n');

const appendScriptContent = (existing, chunk) => {
  const next = typeof chunk === 'string' ? chunk.trim() : '';
  if (!next) {
    return existing || '';
  }
  const base = typeof existing === 'string' ? existing.trim() : '';
  return base ? `${base}\n${next}` : next;
};

/**
 * Generate screenplay scene-by-scene via WriteSceneChain (no single giant response).
 */
export class SceneWriteOrchestrator {
  constructor ({ scriptId, maxScenes = MAX_SCENES_PER_REQUEST } = {}) {
    this.scriptId = scriptId;
    this.maxScenes = maxScenes;
  }

  async run (context, prompt) {
    const scenes = await getSceneOutline(this.scriptId);
    const ordered = sortScenes(scenes).slice(0, this.maxScenes);

    if (!ordered.length) {
      return {
        message: 'Add scenes to your outline before generating from scenes.',
        script: null,
        type: INTENT_TYPES.WRITE_FROM_SCENES,
        metadata: {
          scenesWritten: 0,
          totalScenes: 0,
          timestamp: new Date().toISOString()
        }
      };
    }

    const chain = new WriteSceneChain();
    const scriptChunks = [];
    const stepMessages = [];
    let accumulatedContent = context?.scriptContent || '';
    const chatRequestId = context?.chatRequestId || null;

    for (let index = 0; index < ordered.length; index += 1) {
      const scene = ordered[index];
      const sceneNumber = Number(scene.sortIndex) || index + 1;
      const scenePrompt = `Write scene ${sceneNumber}: ${scene.title || 'Untitled scene'}`;

      const sceneContext = {
        ...context,
        scriptContent: accumulatedContent,
        chatRequestId,
        sceneIndex: sceneNumber
      };

      const result = await chain.run(sceneContext, scenePrompt);
      const chunk = result?.script || '';

      if (chunk.trim()) {
        scriptChunks.push(chunk);
        accumulatedContent = appendScriptContent(accumulatedContent, chunk);
      }

      if (result?.message) {
        stepMessages.push(result.message);
      }
    }

    const combinedScript = joinScriptChunks(scriptChunks);
    const summaryMessage = scriptChunks.length
      ? `Added ${scriptChunks.length} scene${scriptChunks.length === 1 ? '' : 's'} to your script.`
      : 'Could not generate scenes from your outline. Try again or write one scene at a time.';

    const canonical = normalizeWritingResponse({
      assistantMessage: summaryMessage,
      formattedScript: combinedScript || null,
      metadata: {
        scenesWritten: scriptChunks.length,
        totalScenes: ordered.length,
        stepCount: stepMessages.length,
        chatRequestId,
        timestamp: new Date().toISOString()
      },
      type: INTENT_TYPES.WRITE_FROM_SCENES
    });

    return finalizeWritingResponse(canonical, INTENT_TYPES.WRITE_FROM_SCENES);
  }
}
