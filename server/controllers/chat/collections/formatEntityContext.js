import { getScriptCollections } from '../../script/context-collections.service.js';
import { COLLECTION_TYPES } from './collectionTypes.js';

const formatItems = (label, items) => {
  if (!Array.isArray(items) || !items.length) {
    return `${label}: none`;
  }

  const lines = items.map((item, index) => {
    const order = item.sortIndex ?? index + 1;
    const title = item.title || 'Untitled';
    const description = item.description ? ` — ${item.description}` : '';
    return `${order}. ${title}${description}`;
  });

  return `${label}:\n${lines.join('\n')}`;
};

/**
 * Format existing script entities for model context (attachEntityContext only).
 */
export const formatEntityOutlineForPrompt = (collections, types = COLLECTION_TYPES) => {
  if (!collections || typeof collections !== 'object') {
    return 'No existing story entities on this script.';
  }

  const blocks = types.map((type) => {
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    return formatItems(label, collections[type]);
  });

  return blocks.join('\n\n');
};

export const loadEntityOutlineContext = async (scriptId, types = COLLECTION_TYPES) => {
  const collections = await getScriptCollections(scriptId);
  if (!collections) {
    return '';
  }

  return formatEntityOutlineForPrompt(collections, types);
};
