const DEFAULT_CLASS_NAMES = {
    panelHeader: 'list-panel-header',
    panelTitle: 'list-panel-title',
    panelButton: 'list-panel-button',
    panelControls: 'list-panel-controls',
    grid: 'list-grid',
    empty: 'list-empty',
    tile: 'list-tile',
    tileTitle: 'list-tile__title',
    tileTitleInput: 'list-tile__title-input',
    tileMeta: 'list-tile__meta',
    tileActions: 'list-tile__actions',
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
    title: 'Items',
    modalTitle: 'Items',
    add: 'Add',
    find: 'Find',
    fullscreen: 'Full Screen',
    close: 'Close',
    empty: 'No items yet',
    emptyMeta: 'No tags',
    edit: 'Edit',
    delete: 'Delete',
    deleteText: 'x',
    media: 'Media'
};

const DEFAULT_EMPTY_ITEM = {
    id: null,
    title: '',
    description: '',
    notes: '',
    tags: []
};

export const createTaggedListAdapter = (options = {}) => {
    const {
        labels: customLabels,
        classNames: customClassNames,
        dataKey: providedDataKey,
        orderKey: providedOrderKey,
        emptyItem: customEmptyItem,
        supportsAi: supportsAiFlag,
        supportsMedia: supportsMediaFlag,
        ownerType,
        mediaRole,
        store
    } = options;
    const labels = { ...DEFAULT_LABELS, ...(customLabels || {}) };
    const classNames = { ...DEFAULT_CLASS_NAMES, ...(customClassNames || {}) };
    const dataKey = providedDataKey || 'itemId';
    const orderKey = providedOrderKey || dataKey;
    const emptyItem = customEmptyItem || DEFAULT_EMPTY_ITEM;
    const supportsAi = Boolean(supportsAiFlag);
    const supportsMedia = Boolean(supportsMediaFlag);

    if (!store) {
        throw new Error('List adapter requires a store');
    }

    return {
        getId: (item) => item.id,
        getTitle: (item) => item.title,
        getMetaText: (item) => (Array.isArray(item.tags) && item.tags.length
            ? item.tags.join(', ')
            : labels.emptyMeta),
        getEmptyItem: () => ({ ...emptyItem }),
        buildRenamePayload: (title) => ({ title }),
        buildOrderPayload: (items) => items.map((item, index) => ({
            [orderKey]: item.id,
            sortIndex: index
        })),
        createItem: (contextId, payload) => store.createItem(contextId, payload),
        updateItem: (contextId, itemId, payload) => store.updateItem(contextId, itemId, payload),
        deleteItem: (contextId, itemId) => store.deleteItem(contextId, itemId),
        reorderItems: (contextId, order) => store.reorderItems(contextId, order),
        supportsAi,
        generateIdea: (contextId, itemId, draft) => (
            supportsAi && typeof store.generateIdea === 'function'
                ? store.generateIdea(contextId, itemId, draft)
                : null
        ),
        view: {
            labels,
            classNames,
            dataKey,
            supportsMedia,
            ownerType,
            mediaRole
        }
    };
};
