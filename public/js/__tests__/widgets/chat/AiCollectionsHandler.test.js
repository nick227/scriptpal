import { StateManager } from '../../../core/StateManager.js';
import { EventManager } from '../../../core/EventManager.js';
import { AiCollectionsHandler } from '../../../widgets/chat/core/AiCollectionsHandler.js';
import { buildCollectionApplyKey } from '../../../widgets/chat/core/collectionIdempotency.js';

describe('AiCollectionsHandler', () => {
    const buildHandler = (overrides = {}) => {
        const sceneStore = {
            items: [{ id: 5, title: 'Existing', description: 'Old', sortIndex: 0 }],
            createItem: jest.fn(),
            loadItems: jest.fn().mockResolvedValue([]),
            sortItems: jest.fn(function sortItems () {
                this.items.sort((a, b) => Number(a.sortIndex) - Number(b.sortIndex));
            }),
            setItems: jest.fn(function setItems (items) {
                this.items = items;
            })
        };
        const stateManager = {
            getState: jest.fn((key) => key === StateManager.KEYS.CURRENT_SCRIPT
                ? { id: 10 }
                : null)
        };
        const eventManager = {
            publish: jest.fn()
        };

        return {
            handler: new AiCollectionsHandler({
                stores: { scene: sceneStore },
                stateManager,
                eventManager
            }),
            sceneStore,
            eventManager
        };
    };

    test('merges persisted items by id without calling createItem', async () => {
        const { handler, sceneStore } = buildHandler();

        const applied = await handler.handleCollections([
            {
                type: 'scenes',
                items: [{
                    id: 5,
                    title: 'Existing',
                    description: 'Updated from AI',
                    sortIndex: 0
                }]
            }
        ], { chatRequestId: 'turn-1' });

        expect(sceneStore.createItem).not.toHaveBeenCalled();
        expect(sceneStore.items[0].description).toBe('Updated from AI');
        expect(sceneStore.loadItems).toHaveBeenCalledWith(10, { force: true });
        expect(applied).toHaveLength(1);
        expect(applied[0].action).toBe('merged');
    });

    test('skips duplicate application for same chatRequestId type and id', async () => {
        const { handler, sceneStore } = buildHandler();
        const collections = [{
            type: 'scenes',
            items: [{ id: 7, title: 'New Scene', description: 'Fresh' }]
        }];

        await handler.handleCollections(collections, { chatRequestId: 'turn-abc' });
        await handler.handleCollections(collections, { chatRequestId: 'turn-abc' });

        expect(sceneStore.loadItems).toHaveBeenCalledTimes(1);
    });

    test('creates only when server items lack id', async () => {
        const { handler, sceneStore } = buildHandler();
        sceneStore.createItem.mockResolvedValue({ id: 99, title: 'Draft', description: 'New' });

        await handler.handleCollections([
            {
                type: 'scenes',
                items: [{ title: 'Draft', description: 'New' }]
            }
        ], { chatRequestId: 'turn-2' });

        expect(sceneStore.createItem).toHaveBeenCalledWith(10, {
            title: 'Draft',
            description: 'New',
            notes: '',
            tags: []
        });
        expect(sceneStore.loadItems).toHaveBeenCalledWith(10, { force: true });
    });

    test('buildCollectionApplyKey uses id when present else title', () => {
        expect(buildCollectionApplyKey('req-1', 'characters', { id: 3, title: 'Mara' }))
            .toBe('turn:req-1:characters:id:3');
        expect(buildCollectionApplyKey('req-1', 'characters', { title: 'Mara Voss' }))
            .toBe('turn:req-1:characters:title:mara voss');
    });
});
