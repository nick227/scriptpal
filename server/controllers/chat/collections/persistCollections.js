import prisma from '../../../db/prismaClient.js';
import { listScriptItems } from '../../../utils/queryUtils.js';
import { normalizeTitleKey } from './normalizeCollections.js';
import { isSupportedCollectionType } from './collectionTypes.js';

const MODEL_BY_TYPE = {
  scenes: prisma.scene,
  characters: prisma.character,
  locations: prisma.location,
  themes: prisma.theme,
  outlines: prisma.outline
};

const loadExistingTitleKeys = async (scriptId, type) => {
  const model = MODEL_BY_TYPE[type];
  if (!model) {
    return new Set();
  }

  const rows = await listScriptItems(model, scriptId);
  return new Set(rows.map((row) => `${scriptId}:${type}:${normalizeTitleKey(row.title)}`));
};

const nextSortIndex = async (model, scriptId) => {
  const count = await model.count({ where: { scriptId } });
  return count;
};

const persistItem = async (type, scriptId, item) => {
  const model = MODEL_BY_TYPE[type];
  if (!model) {
    return null;
  }

  const sortIndex = typeof item.sortIndex === 'number'
    ? item.sortIndex
    : await nextSortIndex(model, scriptId);

  if (type === 'outlines') {
    const items = Array.isArray(item.outlineItems) && item.outlineItems.length
      ? item.outlineItems
      : [{ text: item.description || item.title, indent: 0 }];

    return model.create({
      data: {
        scriptId,
        title: item.title,
        items,
        sortIndex
      }
    });
  }

  const data = {
    scriptId,
    title: item.title,
    tags: Array.isArray(item.tags) ? item.tags : [],
    sortIndex
  };

  if (item.description) {
    data.description = item.description;
  }
  if (item.notes) {
    data.notes = item.notes;
  }

  return model.create({ data });
};

/**
 * Persist normalized collection items; returns API-facing groups with created rows.
 */
export const persistNormalizedCollections = async (collections, scriptId) => {
  const numericScriptId = Number(scriptId);
  if (!numericScriptId || !Array.isArray(collections)) {
    return { collections: [], skipped: [] };
  }

  const existingKeys = new Set();
  const persistedGroups = [];
  const skipped = [];

  for (const group of collections) {
    if (!isSupportedCollectionType(group.type)) {
      continue;
    }

    const typeKeys = await loadExistingTitleKeys(numericScriptId, group.type);
    typeKeys.forEach((key) => existingKeys.add(key));

    const createdItems = [];

    for (const item of group.items) {
      const dedupeKey = `${numericScriptId}:${group.type}:${normalizeTitleKey(item.title)}`;
      if (existingKeys.has(dedupeKey)) {
        skipped.push({ type: group.type, title: item.title, reason: 'duplicate' });
        continue;
      }

      const row = await persistItem(group.type, numericScriptId, item);
      if (row) {
        existingKeys.add(dedupeKey);
        createdItems.push({
          id: row.id,
          scriptId: numericScriptId,
          title: row.title,
          description: row.description ?? item.description ?? '',
          notes: row.notes ?? item.notes ?? '',
          tags: Array.isArray(item.tags) ? item.tags : [],
          source: item.source || 'ai',
          chatRequestId: item.chatRequestId || null,
          generatedFromIntent: item.generatedFromIntent || null,
          collectionType: group.type,
          sortIndex: row.sortIndex
        });
      }
    }

    if (createdItems.length) {
      persistedGroups.push({
        type: group.type,
        items: createdItems
      });
    }
  }

  return { collections: persistedGroups, skipped };
};

export const loadExistingCollectionKeys = async (scriptId) => {
  const numericScriptId = Number(scriptId);
  if (!numericScriptId) {
    return [];
  }

  const keys = [];
  const types = Object.keys(MODEL_BY_TYPE);

  for (const type of types) {
    const typeKeys = await loadExistingTitleKeys(numericScriptId, type);
    typeKeys.forEach((key) => keys.push(key));
  }

  return keys;
};
