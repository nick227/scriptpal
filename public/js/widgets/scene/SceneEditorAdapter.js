import { createTaggedEditorAdapter } from '../editor/TaggedEditorAdapterFactory.js';
import { ITEM_LABELS } from '../../shared/itemLabels.js';

export const createSceneEditorAdapter = () => createTaggedEditorAdapter({
    enableAiTitle: true,
    labels: {
        title: ITEM_LABELS.SCENE,
        close: 'cancel',
        save: 'Save',
        aiGenerate: 'ai generate'
    }
});
