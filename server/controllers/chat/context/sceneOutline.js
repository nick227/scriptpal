import prisma from '../../../db/prismaClient.js';
import { listScriptItems } from '../../../utils/queryUtils.js';

const mapSceneSummary = (scene) => ({
  id: scene.id,
  sortIndex: scene.sortIndex,
  title: scene.title,
  description: scene.description,
  notes: scene.notes
});

export const getSceneOutline = async (scriptId) => {
  const scriptNumericId = Number(scriptId);
  if (!scriptNumericId) {
    return [];
  }

  const scenes = await listScriptItems(prisma.scene, scriptNumericId);
  return scenes.map(mapSceneSummary);
};

export const formatSceneOutlineForPrompt = (scenes) => {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return 'No scenes in the outline yet.';
  }

  return scenes
    .map((scene, index) => {
      const order = scene.sortIndex ?? index + 1;
      const title = scene.title || 'Untitled scene';
      const description = scene.description || '';
      const notes = scene.notes ? ` Notes: ${scene.notes}` : '';
      return `${order}. ${title}${description ? ` — ${description}` : ''}${notes}`;
    })
    .join('\n');
};
