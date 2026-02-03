import { ITEM_EMPTY_LABELS, ITEM_LIST_LABELS } from '../../shared/itemLabels.js';

const DEFAULT_CLASS_NAMES = {
    panelHeader: 'list-panel-header',
    panelTitle: 'list-panel-title',
    panelButton: 'list-panel-button',
    panelControls: 'list-panel-controls',
    grid: 'list-grid media-grid',
    empty: 'list-empty',
    tile: 'list-tile media-tile',
    tileTitle: 'list-tile__title',
    tileTitleInput: 'list-tile__title-input',
    tileMeta: 'list-tile__meta',
    tileActions: 'list-tile__actions',
    tileMedia: 'list-tile__media',
    modal: 'list-browser-modal',
    modalBackdrop: 'list-browser-modal__backdrop',
    modalContent: 'list-browser-modal__content',
    modalHeader: 'list-browser-modal__header',
    modalControls: 'list-browser-modal__controls',
    modalGrid: 'list-browser-modal__grid',
    modalHidden: 'hidden',
    modalGridFew: 'is-few',
    dragging: 'is-dragging',
    iconButton: 'icon-button'
};

const DEFAULT_LABELS = {
    title: ITEM_LIST_LABELS.MEDIA,
    modalTitle: ITEM_LIST_LABELS.MEDIA,
    add: 'Add',
    fullscreen: 'Full Screen',
    close: 'Close',
    empty: ITEM_EMPTY_LABELS.MEDIA,
    emptyMeta: '',
    edit: 'View',
    delete: 'Delete',
    deleteText: 'x',
    media: 'Media'
};

/**
 * Creates an adapter for the media list
 * Media items don't support AI generation or inline editing
 * Works with the unified media library
 */
export const createMediaListAdapter = (store) => {
    if (!store) {
        throw new Error('Media list adapter requires a store');
    }

    return {
        getId: (item) => item.id,
        getTitle: (item) => item.title || 'Media',
        getMetaText: (item) => item.type || '',
        getMediaUrl: (item) => item.url || '',
        getMediaType: (item) => item.type || 'image',
        getEmptyItem: () => ({ id: null, title: '', url: '', type: 'image' }),
        buildRenamePayload: () => null,
        buildOrderPayload: () => [],
        createItem: () => null,
        updateItem: () => null,
        deleteItem: (contextId, itemId) => store.deleteItem(contextId, itemId),
        reorderItems: () => null,
        supportsAi: false,
        generateIdea: () => null,
        view: {
            labels: DEFAULT_LABELS,
            classNames: DEFAULT_CLASS_NAMES,
            dataKey: 'mediaId',
            supportsMedia: false,
            ownerType: 'script',
            mediaRole: 'gallery',
            isMediaGrid: true
        }
    };
};
