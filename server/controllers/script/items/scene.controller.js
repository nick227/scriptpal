import prisma from '../../../db/prismaClient.js';
import { router } from '../../langchain/router/index.js';
import { getPromptById } from '../../../../shared/promptRegistry.js';
import { createIntentResult } from '../../common/ai-response.service.js';
import { INTENT_TYPES } from '../../langchain/constants.js';
import { loadScriptOrThrow } from '../../script-services/scriptRequestUtils.js';
import { ensureSceneOwnership } from '../../../middleware/scriptOwnership.js';
import { buildScriptContextBundle } from '../../script/context-builder.service.js';
import { parseNumericId, parseSortIndex } from '../../../utils/idUtils.js';
import { requireNumericParam } from '../../../utils/requestUtils.js';
import { listScriptItems } from '../../../utils/queryUtils.js';
import { attachMediaToItems, shouldIncludeMedia } from '../../../services/media/MediaIncludeService.js';

const SCENE_IDEA_PROMPT = getPromptById('scene-idea');

if (!SCENE_IDEA_PROMPT) {
  throw new Error('Scene idea prompt definition is missing from the registry');
}

const normalizeSceneDraft = (scene, draft) => {
  const hasDraft = draft && typeof draft === 'object';
  const tags = hasDraft && Array.isArray(draft.tags) ? draft.tags : scene.tags || [];
  return {
    id: scene.id,
    title: hasDraft && typeof draft.title === 'string' ? draft.title : scene.title,
    description: hasDraft && typeof draft.description === 'string' ? draft.description : scene.description,
    notes: hasDraft && typeof draft.notes === 'string' ? draft.notes : scene.notes,
    tags,
    sortIndex: scene.sortIndex
  };
};

const sceneController = {
  getScriptScenes: async(req, res) => {
    try {
      const { script } = req;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const scenes = await prisma.scene.findMany({
        where: { scriptId: script.id },
        orderBy: [
          { sortIndex: 'asc' },
          { createdAt: 'asc' }
        ]
      });
      if (!shouldIncludeMedia(req)) {
        return res.json(scenes);
      }
      const decorated = await attachMediaToItems({
        items: scenes,
        userId: req.userId,
        ownerType: 'scene',
        ownerIdKey: 'id'
      });
      res.json(decorated);
    } catch (error) {
      console.error('Error getting scenes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createScene: async(req, res) => {
    try {
      const { script, body } = req;
      const { title, description, notes, tags, sortIndex } = body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      if (tags !== undefined && !Array.isArray(tags)) {
        return res.status(400).json({ error: 'Tags must be an array' });
      }

      let nextSortIndex = parseSortIndex(sortIndex);
      if (nextSortIndex === null) {
        const count = await prisma.scene.count({
          where: { scriptId: script.id }
        });
        nextSortIndex = count;
      }

      const data = {
        scriptId: script.id,
        title,
        tags: Array.isArray(tags) ? tags : [],
        sortIndex: nextSortIndex
      };
      if (Object.prototype.hasOwnProperty.call(body, 'description')) {
        data.description = description;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
        data.notes = notes;
      }

      const scene = await prisma.scene.create({ data });
      res.status(201).json(scene);
    } catch (error) {
      console.error('Error creating scene:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateScene: async(req, res) => {
    try {
      const { script, body, params } = req;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const sceneId = parseNumericId(params.sceneId);
      if (!sceneId) {
        return res.status(400).json({ error: 'Invalid scene ID' });
      }

      const scene = await prisma.scene.findFirst({
        where: { id: sceneId, scriptId: script.id }
      });
      if (!scene) {
        return res.status(404).json({ error: 'Scene not found' });
      }

      const data = {};
      if (Object.prototype.hasOwnProperty.call(body, 'title')) {
        data.title = body.title;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'description')) {
        data.description = body.description;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
        data.notes = body.notes;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
        if (!Array.isArray(body.tags)) {
          return res.status(400).json({ error: 'Tags must be an array' });
        }
        data.tags = body.tags;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'sortIndex')) {
        const parsedSortIndex = parseSortIndex(body.sortIndex);
        if (parsedSortIndex === null) {
          return res.status(400).json({ error: 'Sort index must be a non-negative integer' });
        }
        data.sortIndex = parsedSortIndex;
      }
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No scene updates provided' });
      }

      const updated = await prisma.scene.update({
        where: { id: scene.id },
        data
      });
      res.json(updated);
    } catch (error) {
      console.error('Error updating scene:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteScene: async(req, res) => {
    try {
      const { script, params } = req;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const sceneId = parseNumericId(params.sceneId);
      if (!sceneId) {
        return res.status(400).json({ error: 'Invalid scene ID' });
      }

      const scene = await prisma.scene.findFirst({
        where: { id: sceneId, scriptId: script.id }
      });
      if (!scene) {
        return res.status(404).json({ error: 'Scene not found' });
      }

      await prisma.scene.delete({
        where: { id: scene.id }
      });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting scene:', error);
      if (error && error.code === 'P2025') {
        return res.status(404).json({ error: 'Scene not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  reorderScenes: async(req, res) => {
    try {
      const { script, body } = req;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const { order } = body;
      if (!Array.isArray(order) || order.length === 0) {
        return res.status(400).json({ error: 'Scene order is required' });
      }

      const sceneIds = order
        .map(entry => parseNumericId(entry.sceneId))
        .filter(Boolean);

      if (sceneIds.length !== order.length) {
        return res.status(400).json({ error: 'Invalid scene order payload' });
      }

      const scenes = await prisma.scene.findMany({
        where: { id: { in: sceneIds }, scriptId: script.id },
        select: { id: true }
      });

      if (scenes.length !== sceneIds.length) {
        return res.status(400).json({ error: 'Scene order contains invalid scene IDs' });
      }

      const updateOps = order.map((entry, index) => {
        const sceneId = parseNumericId(entry.sceneId);
        return prisma.scene.update({
          where: { id: sceneId },
          data: { sortIndex: index }
        });
      });

      await prisma.$transaction(updateOps);
      res.status(204).send();
    } catch (error) {
      console.error('Error reordering scenes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  generateSceneIdea: async(req, res) => {
    try {
      const scriptId = requireNumericParam(req, res, 'scriptId', 'script ID');
      if (!scriptId) {
        return;
      }
      const sceneId = parseNumericId(req.params.sceneId);

      const { script } = await loadScriptOrThrow(req, {
        required: true,
        allowPublic: false,
        requireEditable: true
      });

      let scene = null;
      if (sceneId) {
        scene = await ensureSceneOwnership(req.userId, sceneId);
        if (!scene || scene.scriptId !== scriptId) {
          return res.status(404).json({ error: 'Scene not found' });
        }
      }

      const scenes = await listScriptItems(prisma.scene, scriptId);
      const otherScenes = scenes
        .filter(item => (sceneId ? Number(item.id) !== Number(sceneId) : true))
        .map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          sortIndex: item.sortIndex
        }));

      const draft = req.body && req.body.draft ? req.body.draft : null;
      const currentScene = scene
        ? normalizeSceneDraft(scene, draft)
        : {
          id: null,
          title: draft?.title || '',
          description: draft?.description || '',
          notes: draft?.notes || '',
          tags: Array.isArray(draft?.tags) ? draft.tags : [],
          sortIndex: null
        };
      const contextBundle = await buildScriptContextBundle({
        scriptId,
        script,
        includeScriptContext: true,
        allowStructuredExtraction: true
      });

      const intentResult = createIntentResult(INTENT_TYPES.SCENE_IDEA);
      const response = await router.route(intentResult, {
        userId: req.userId,
        scriptId,
        intent: INTENT_TYPES.SCENE_IDEA,
        scriptTitle: contextBundle.scriptTitle,
        scriptDescription: contextBundle.scriptDescription,
        scriptContent: contextBundle.scriptContent,
        currentScene,
        otherScenes,
        scriptCollections: contextBundle.scriptCollections,
        disableHistory: true,
        chainConfig: {
          shouldGenerateQuestions: false
        },
        systemInstruction: SCENE_IDEA_PROMPT.systemInstruction
      }, SCENE_IDEA_PROMPT.userPrompt);

      const payload = response?.response || response;
      res.status(200).json({
        title: payload?.title || '',
        description: payload?.description || ''
      });
    } catch (error) {
      console.error('Error generating scene idea:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default sceneController;
