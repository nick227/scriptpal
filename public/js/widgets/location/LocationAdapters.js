import { createTaggedEditorAdapter } from '../editor/TaggedEditorAdapterFactory.js';
import { createTaggedListAdapter } from '../list/TaggedListAdapterFactory.js';
import { ITEM_EMPTY_LABELS, ITEM_LABELS, ITEM_LIST_LABELS } from '../../shared/itemLabels.js';

export const createLocationListAdapter = (store) => createTaggedListAdapter({
    store,
    dataKey: 'locationId',
    orderKey: 'locationId',
    supportsAi: true,
    labels: {
        title: ITEM_LIST_LABELS.LOCATION,
        modalTitle: ITEM_LIST_LABELS.LOCATION,
        empty: ITEM_EMPTY_LABELS.LOCATION,
        emptyMeta: ITEM_EMPTY_LABELS.EMPTY_META
    }
});

export const createLocationEditorAdapter = () => createTaggedEditorAdapter({
    enableAiTitle: true,
    labels: {
        title: ITEM_LABELS.LOCATION_ITEM,
        close: 'cancel',
        save: 'save'
    }
});
