export const CATEGORY_KEYS = {
    GENERAL: 'general',
    STORY: 'story',
    CHARACTER: 'character',
    LOCATION: 'location'
};

export const CATEGORIES = [
    {
        key: CATEGORY_KEYS.GENERAL,
        label: 'General',
        actionLabel: '+ Associate',
        target: 8,
        min: 6,
        max: 10,
        ring: 0
    },
    {
        key: CATEGORY_KEYS.STORY,
        label: 'Story',
        actionLabel: '+ Story',
        target: 2,
        min: 1,
        max: 3,
        ring: 1
    },
    {
        key: CATEGORY_KEYS.CHARACTER,
        label: 'Character',
        actionLabel: '+ Character',
        target: 3,
        min: 2,
        max: 4,
        ring: 2
    },
    {
        key: CATEGORY_KEYS.LOCATION,
        label: 'Location',
        actionLabel: '+ Location',
        target: 3,
        min: 2,
        max: 4,
        ring: 3
    }
];

export const CATEGORY_BY_KEY = CATEGORIES.reduce((lookup, category) => {
    lookup[category.key] = category;
    return lookup;
}, {});

export const MAX_NOTES_PER_ACTION = 12;
export const THROTTLE_WINDOW_MS = 5000;
export const STAGGER_DELAY_MS = 140;
export const NOTE_WIDTH = 190;
export const NOTE_HEIGHT = 110;
