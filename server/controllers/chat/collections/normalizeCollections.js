import { normalizeCollectionType } from './collectionTypes.js';
import { validateLooseCollections } from './validateCollections.js';

export const normalizeTitleKey = (title) => {
  if (typeof title !== 'string') {
    return '';
  }

  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => cleanText(tag))
    .filter(Boolean)
    .slice(0, 12);
};

const normalizeLooseItem = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const title = cleanText(item.title || item.name);
  if (!title) {
    return null;
  }

  return {
    title,
    description: cleanText(item.description),
    notes: cleanText(item.notes),
    tags: normalizeTags(item.tags)
  };
};

const outlineItemsFromDescription = (description) => {
  const text = cleanText(description);
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line, indent: 0 }));
};

/**
 * Normalize loose AI groups into app-safe entity items (not yet persisted).
 */
export const normalizeLooseCollections = ({
  collections,
  scriptId,
  chatRequestId = null,
  generatedFromIntent = null
}) => {
  const validation = validateLooseCollections(collections);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, collections: [] };
  }

  const normalizedGroups = [];

  validation.groups.forEach((group) => {
    const items = group.items
      .map(normalizeLooseItem)
      .filter(Boolean)
      .map((item) => ({
        scriptId,
        title: item.title,
        description: item.description,
        notes: item.notes,
        tags: item.tags,
        source: 'ai',
        chatRequestId,
        generatedFromIntent,
        collectionType: group.type,
        ...(group.type === 'outlines' && item.description
          ? { outlineItems: outlineItemsFromDescription(item.description) }
          : {})
      }));

    if (items.length) {
      normalizedGroups.push({
        type: group.type,
        items
      });
    }
  });

  return {
    valid: normalizedGroups.length > 0,
    errors: normalizedGroups.length ? [] : ['No valid collection items'],
    collections: normalizedGroups
  };
};

/**
 * Dedupe normalized items by scriptId + type + normalized title.
 */
export const dedupeNormalizedCollections = (collections, existingKeys) => {
  const seen = new Set(existingKeys);
  const skipped = [];
  const deduped = [];

  collections.forEach((group) => {
    const kept = [];

    group.items.forEach((item) => {
      const key = `${item.scriptId}:${group.type}:${normalizeTitleKey(item.title)}`;
      if (seen.has(key)) {
        skipped.push({ type: group.type, title: item.title });
        return;
      }
      seen.add(key);
      kept.push(item);
    });

    if (kept.length) {
      deduped.push({ type: group.type, items: kept });
    }
  });

  return { collections: deduped, skipped };
};
