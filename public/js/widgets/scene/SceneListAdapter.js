import { createTaggedListAdapter } from '../list/TaggedListAdapterFactory.js';
import { ITEM_EMPTY_LABELS, ITEM_LIST_LABELS } from '../../shared/itemLabels.js';

export const createSceneListAdapter = (sceneStore) => createTaggedListAdapter({
    store: sceneStore,
    dataKey: 'sceneId',
    orderKey: 'sceneId',
    supportsAi: true,
    supportsMedia: true,
    ownerType: 'scene',
    mediaRole: 'cover',
    labels: {
        title: ITEM_LIST_LABELS.SCENES,
        modalTitle: ITEM_LIST_LABELS.SCENES,
        empty: ITEM_EMPTY_LABELS.SCENES,
        emptyMeta: ITEM_EMPTY_LABELS.EMPTY_META
    }
});
