export const COLLECTION_TYPES = Object.freeze([
  'scenes',
  'characters',
  'locations',
  'themes',
  'outlines'
]);

const TYPE_SET = new Set(COLLECTION_TYPES);

export const normalizeCollectionType = (type) => {
  if (typeof type !== 'string') {
    return null;
  }
  const normalized = type.trim().toLowerCase();
  return TYPE_SET.has(normalized) ? normalized : null;
};

export const isSupportedCollectionType = (type) => TYPE_SET.has(type);
