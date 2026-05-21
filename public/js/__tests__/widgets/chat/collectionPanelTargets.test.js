import { resolveCollectionPanelTarget } from '../../../widgets/chat/core/collectionPanelTargets.js';

describe('resolveCollectionPanelTarget', () => {
    test('prefers scenes when multiple types are present', () => {
        expect(resolveCollectionPanelTarget(['characters', 'scenes'])).toBe('user-scenes');
    });

    test('maps characters to user-characters', () => {
        expect(resolveCollectionPanelTarget(['characters'])).toBe('user-characters');
    });
});
