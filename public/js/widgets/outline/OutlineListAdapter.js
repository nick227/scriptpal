import { createTaggedListAdapter } from '../list/TaggedListAdapterFactory.js';
import { ITEM_EMPTY_LABELS, ITEM_LIST_LABELS } from '../../shared/itemLabels.js';

const getMetaText = (item) => {
    const count = item.items?.length || 0;
    if (!count) return 'No items';
    const arr = Array.isArray(item.items) ? item.items : [];
    return arr
        .slice(0, 3)
        .map((i) => `• ${typeof i === 'string' ? i : (i?.text ?? '')}`)
        .join('  ');
};

export const createOutlineListAdapter = (outlineStore) => {
    const base = createTaggedListAdapter({
        store: outlineStore,
        dataKey: 'outlineId',
        orderKey: 'outlineId',
        supportsAi: true,
        supportsMedia: false,
        emptyItem: { title: '', items: [] },
        labels: {
            title: ITEM_LIST_LABELS.OUTLINES,
            modalTitle: ITEM_LIST_LABELS.OUTLINES,
            empty: ITEM_EMPTY_LABELS.OUTLINES,
            emptyMeta: 'No items'
        }
    });
    return {
        ...base,
        getMetaText
    };
};
