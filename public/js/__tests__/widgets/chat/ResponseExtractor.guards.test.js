import {
    extractApiResponseContent,
    extractRenderableContent
} from '../../../widgets/chat/core/ResponseExtractor.js';

describe('ResponseExtractor JSON guards', () => {
    const collectionsJson = JSON.stringify({
        collections: [{ type: 'scenes', items: [{ title: 'One', description: 'Beat' }] }]
    });

    test('does not stringify script JSON into chat when message is missing', () => {
        const content = extractRenderableContent({
            script: collectionsJson,
            collections: [{ type: 'scenes', items: [] }]
        });
        expect(content).toBe('');
    });

    test('extractApiResponseContent does not surface script-array JSON in chat', () => {
        const malformed = JSON.stringify({
            script: ['INT. WAREHOUSE - NIGHT', 'SARAH', 'Hello.']
        });
        const content = extractApiResponseContent({
            response: { message: malformed }
        });
        expect(content === null || !String(content).includes('"script"')).toBe(true);
    });

    test('extractApiResponseContent does not surface raw collections JSON in chat', () => {
        const data = {
            response: {
                message: collectionsJson
            }
        };
        const content = extractApiResponseContent(data);
        expect(content === null || !content.includes('"type"')).toBe(true);
    });
});
