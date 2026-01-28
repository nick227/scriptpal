const formatCollection = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return `${label}: None.`;
  }
  const lines = items.map(item => {
    const title = item.title || 'Untitled';
    const description = item.description || '';
    const sortIndex = Number.isFinite(item.sortIndex) ? item.sortIndex : null;
    const orderLabel = sortIndex !== null ? `#${sortIndex}` : 'Unordered';
    return `${orderLabel}: ${title}${description ? ` — ${description}` : ''}`;
  });
  return `${label}:\n${lines.join('\n')}`;
};

export const formatScriptCollections = (collections) => {
  if (!collections || typeof collections !== 'object') {
    return '';
  }
  const blocks = [
    formatCollection('Scenes', collections.scenes),
    formatCollection('Characters', collections.characters),
    formatCollection('Locations', collections.locations),
    formatCollection('Themes', collections.themes)
  ].filter(Boolean);

  if (blocks.length === 0) {
    return '';
  }

  return `Related Collections:\n${blocks.join('\n\n')}`;
};
