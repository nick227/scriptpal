/** Collection type → side panel navigation target (data-target). */
export const COLLECTION_TYPE_TO_PANEL = {
    scenes: 'user-scenes',
    characters: 'user-characters',
    locations: 'user-location',
    outlines: 'user-outlines',
    themes: 'user-themes'
};

const PANEL_PRIORITY = ['scenes', 'characters', 'locations', 'outlines', 'themes'];

/**
 * Pick which sidebar tab to show when multiple collection types were updated.
 */
export const resolveCollectionPanelTarget = (types = []) => {
    const normalized = new Set(
        (Array.isArray(types) ? types : [])
            .map((type) => (typeof type === 'string' ? type.trim().toLowerCase() : ''))
            .filter(Boolean)
    );

    for (const preferred of PANEL_PRIORITY) {
        if (normalized.has(preferred) && COLLECTION_TYPE_TO_PANEL[preferred]) {
            return COLLECTION_TYPE_TO_PANEL[preferred];
        }
    }

    const first = [...normalized][0];
    return first ? (COLLECTION_TYPE_TO_PANEL[first] || null) : null;
};
