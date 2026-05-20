import { normalizeCollectionType } from './collectionTypes.js';

const FORBIDDEN_KEYS = new Set([
  'panel',
  'tab',
  'render',
  'sidebar',
  'component',
  'ui',
  'layout'
]);

const hasForbiddenUiKeys = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 4) {
    return false;
  }

  return Object.keys(value).some((key) => {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEYS.has(lower)) {
      return true;
    }
    const child = value[key];
    if (Array.isArray(child)) {
      return child.some((entry) => hasForbiddenUiKeys(entry, depth + 1));
    }
    if (child && typeof child === 'object') {
      return hasForbiddenUiKeys(child, depth + 1);
    }
    return false;
  });
};

const validateItem = (item, errors, path) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    errors.push(`${path}: item must be an object`);
    return null;
  }

  if (hasForbiddenUiKeys(item)) {
    errors.push(`${path}: item contains UI-specific fields`);
    return null;
  }

  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) {
    errors.push(`${path}: missing title`);
    return null;
  }

  return true;
};

/**
 * Validate loose AI collection groups (pre-normalization).
 */
export const validateLooseCollections = (collections) => {
  const errors = [];

  if (collections == null) {
    return { valid: true, errors: [], groups: [] };
  }

  if (!Array.isArray(collections)) {
    return { valid: false, errors: ['collections must be an array'], groups: [] };
  }

  if (hasForbiddenUiKeys({ collections })) {
    errors.push('collections must not contain UI instructions');
  }

  const groups = [];

  collections.forEach((group, groupIndex) => {
    const path = `collections[${groupIndex}]`;
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      errors.push(`${path}: group must be an object`);
      return;
    }

    if (hasForbiddenUiKeys(group)) {
      errors.push(`${path}: group contains UI-specific fields`);
      return;
    }

    const type = normalizeCollectionType(group.type);
    if (!type) {
      errors.push(`${path}: unsupported type`);
      return;
    }

    const items = Array.isArray(group.items) ? group.items : [];
    if (!items.length) {
      errors.push(`${path}: items must be a non-empty array`);
      return;
    }

    items.forEach((item, itemIndex) => {
      validateItem(item, errors, `${path}.items[${itemIndex}]`);
    });

    groups.push({ type, items });
  });

  return {
    valid: errors.length === 0,
    errors,
    groups
  };
};

/**
 * Validate normalized collections for API output.
 */
export const validateNormalizedCollections = (collections, { required = false } = {}) => {
  const errors = [];
  const groups = Array.isArray(collections) ? collections : [];

  if (required && !groups.length) {
    errors.push('At least one collection group is required');
  }

  groups.forEach((group, groupIndex) => {
    const path = `collections[${groupIndex}]`;
    const type = normalizeCollectionType(group?.type);
    if (!type) {
      errors.push(`${path}: unsupported type`);
      return;
    }

    const items = Array.isArray(group?.items) ? group.items : [];
    if (!items.length) {
      errors.push(`${path}: items required`);
      return;
    }

    items.forEach((item, itemIndex) => {
      if (!item?.title?.trim()) {
        errors.push(`${path}.items[${itemIndex}]: missing title`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    itemCount: groups.reduce((sum, group) => sum + (group.items?.length || 0), 0)
  };
};
