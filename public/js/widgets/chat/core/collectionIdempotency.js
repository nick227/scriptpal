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

/**
 * Stable key for applied collection side effects (per script).
 */
export const buildCollectionApplyKey = (chatRequestId, type, item) => {
    const idPart = item?.id != null ? `id:${item.id}` : '';
    const titlePart = normalizeTitleKey(item?.title || item?.name);
    const titleKey = titlePart ? `title:${titlePart}` : '';

    if (chatRequestId && type) {
        return `turn:${chatRequestId}:${type}:${idPart || titleKey}`;
    }

    return `${type}:${idPart || titleKey}`;
};
