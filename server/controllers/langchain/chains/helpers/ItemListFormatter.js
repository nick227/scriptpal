export const formatItemBlock = (item, label) => {
  if (!item || typeof item !== 'object') {
    return 'None.';
  }
  const title = item.title || `Untitled ${label}`;
  const description = item.description || '';
  const notes = item.notes || '';
  const tags = Array.isArray(item.tags) ? item.tags.join(', ') : '';
  const sortIndex = Number.isFinite(item.sortIndex) ? item.sortIndex : null;

  const lines = [
    `Title: ${title}`,
    description ? `Description: ${description}` : null,
    notes ? `Notes: ${notes}` : null,
    tags ? `Tags: ${tags}` : null,
    sortIndex !== null ? `Order: ${sortIndex}` : null
  ].filter(Boolean);

  return lines.join('\n');
};

export const formatItemList = (items, label) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 'None.';
  }
  return items.map(item => {
    const title = item.title || `Untitled ${label}`;
    const description = item.description || '';
    const sortIndex = Number.isFinite(item.sortIndex) ? item.sortIndex : null;
    const orderLabel = sortIndex !== null ? `#${sortIndex}` : 'Unordered';
    return `${orderLabel}: ${title}${description ? ` — ${description}` : ''}`;
  }).join('\n');
};
