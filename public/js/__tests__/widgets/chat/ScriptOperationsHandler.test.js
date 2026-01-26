import { ScriptOperationsHandler } from '../../../widgets/chat/core/ScriptOperationsHandler.js';

describe('ScriptOperationsHandler append flow', () => {
    test('handles APPEND_SCRIPT intent by calling orchestrator', async () => {
        const formattedScript = Array.from({ length: 12 }, (_, index) => `LINE ${index + 1}`).join('\n');
        const orchestrator = {
            handleScriptAppend: jest.fn().mockResolvedValue(true)
        };
        const handler = new ScriptOperationsHandler({
            getScriptOrchestrator: () => orchestrator
        });

        const data = {
            response: {
                content: 'INT. ROOM - DAY\nJOHN\nhello there',
                metadata: {
                    formattedScript
                }
            }
        };

        await handler.handleIntent('APPEND_SCRIPT', data);

        expect(orchestrator.handleScriptAppend).toHaveBeenCalledWith({
            content: formattedScript,
            isFromAppend: true
        });
    });

    test('does not append when content missing', async () => {
        const orchestrator = {
            handleScriptAppend: jest.fn().mockResolvedValue(true)
        };
        const handler = new ScriptOperationsHandler({
            getScriptOrchestrator: () => orchestrator
        });

        await handler.handleIntent('APPEND_SCRIPT', { response: {} });

        expect(orchestrator.handleScriptAppend).not.toHaveBeenCalled();
    });
});
