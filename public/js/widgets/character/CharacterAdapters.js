import { createTaggedEditorAdapter } from '../editor/TaggedEditorAdapterFactory.js';
import { createTaggedListAdapter } from '../list/TaggedListAdapterFactory.js';
import { ITEM_EMPTY_LABELS, ITEM_LABELS, ITEM_LIST_LABELS } from '../../shared/itemLabels.js';

export const createCharacterListAdapter = (store) => createTaggedListAdapter({
    store,
    dataKey: 'characterId',
    orderKey: 'characterId',
    supportsAi: true,
    labels: {
        title: ITEM_LIST_LABELS.CHARACTERS,
        modalTitle: ITEM_LIST_LABELS.CHARACTERS,
        empty: ITEM_EMPTY_LABELS.CHARACTERS,
        emptyMeta: ITEM_EMPTY_LABELS.EMPTY_META
    }
});

export const createCharacterEditorAdapter = () => createTaggedEditorAdapter({
    enableAiTitle: true,
    labels: {
        title: ITEM_LABELS.CHARACTER,
        close: 'cancel',
        save: 'save'
    }
});
