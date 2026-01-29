export const resolveCacheState = ({ currentId, nextId, items, force }) => {
    const normalizedNext = nextId ? String(nextId) : '';
    const normalizedCurrent = currentId ? String(currentId) : '';
    const hasChanged = Boolean(normalizedCurrent) && normalizedCurrent !== normalizedNext;
    const shouldReturnCache = items.length > 0
        && !force
        && (normalizedCurrent === normalizedNext || !normalizedCurrent);
    return {
        hasChanged,
        shouldReturnCache
    };
};
