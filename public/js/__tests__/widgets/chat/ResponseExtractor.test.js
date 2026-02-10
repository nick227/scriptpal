import {
    extractApiResponseContent,
    extractRenderableContent
} from '../../../widgets/chat/core/ResponseExtractor.js';

describe('ResponseExtractor', () => {
    test('extractApiResponseContent renders idea_nudges payloads', () => {
        const data = {
            response: {
                message: JSON.stringify({
                    idea_nudges: [
                        {
                            idea: 'Add a rival chemist who sabotages James.',
                            reason: 'Raises stakes and adds active conflict.'
                        }
                    ]
                })
            }
        };

        const content = extractApiResponseContent(data);
        expect(content).toContain('Idea 1:');
        expect(content).toContain('Reason:');
    });

    test('extractApiResponseContent renders status payloads', () => {
        const data = {
            response: {
                message: JSON.stringify({
                    current_state_summary: 'James is close to a breakthrough.',
                    progress: 'Act one is stable.',
                    strengths: 'Clear protagonist drive.',
                    next_focus_area: 'Increase pressure from external forces.'
                })
            }
        };

        const content = extractApiResponseContent(data);
        expect(content).toContain('current state summary');
        expect(content).toContain('next focus area');
    });

    test('extractRenderableContent does not drop structured objects', () => {
        const content = extractRenderableContent({
            intent: 'GENERAL_CONVERSATION',
            reason: 'The user asked for non-script discussion.'
        });

        expect(content).toContain('intent: GENERAL_CONVERSATION');
        expect(content).toContain('reason:');
    });
});

