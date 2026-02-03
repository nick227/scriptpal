import prisma from '../../db/prismaClient.js';
import { listScriptItems } from '../../utils/queryUtils.js';

const mapItemSummary = (item) => ({
  id: item.id,
  title: item.title,
  description: item.description,
  sortIndex: item.sortIndex
});

const loadItems = async (model, scriptId) => listScriptItems(model, scriptId);

export const getScriptCollections = async (scriptId) => {
  const scriptNumericId = Number(scriptId);
  if (!scriptNumericId) {
    return null;
  }

  const [scenes, characters, locations, themes] = await Promise.all([
    loadItems(prisma.scene, scriptNumericId),
    loadItems(prisma.character, scriptNumericId),
    loadItems(prisma.location, scriptNumericId),
    loadItems(prisma.theme, scriptNumericId)
  ]);

  return {
    scenes: scenes.map(mapItemSummary),
    characters: characters.map(mapItemSummary),
    locations: locations.map(mapItemSummary),
    themes: themes.map(mapItemSummary)
  };
};
