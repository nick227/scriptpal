import { createTaggedEditorAdapter } from '../editor/TaggedEditorAdapterFactory.js';
import { createTaggedListAdapter } from '../list/TaggedListAdapterFactory.js';
import { ITEM_EMPTY_LABELS, ITEM_LABELS, ITEM_LIST_LABELS } from '../../shared/itemLabels.js';

export const createThemeListAdapter = (store) => createTaggedListAdapter({
    store,
    dataKey: 'themeId',
    orderKey: 'themeId',
    supportsAi: true,
    supportsMedia: true,
    ownerType: 'theme',
    mediaRole: 'cover',
    labels: {
        title: ITEM_LIST_LABELS.THEMES,
        modalTitle: ITEM_LIST_LABELS.THEMES,
        empty: ITEM_EMPTY_LABELS.THEMES,
        emptyMeta: ITEM_EMPTY_LABELS.EMPTY_META
    }
});

export const createThemeEditorAdapter = () => createTaggedEditorAdapter({
    enableAiTitle: true,
    labels: {
        title: ITEM_LABELS.THEME,
        close: 'cancel',
        save: 'save'
    }
});
