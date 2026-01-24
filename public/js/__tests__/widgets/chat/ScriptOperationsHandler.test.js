import { ScriptOperationsHandler } from '../../../widgets/chat/ScriptOperationsHandler.js';

describe('ScriptOperationsHandler append flow', () => {
    test('handles APPEND_SCRIPT intent by calling orchestrator', async () => {
        const orchestrator = {
            handleScriptAppend: jest.fn().mockResolvedValue(true)
        };
        const handler = new ScriptOperationsHandler({
            getScriptOrchestrator: () => orchestrator
        });

        const data = {
            response: {
                content: 'INT. ROOM - DAY\nJOHN\nhello there'
            }
        };

        await handler.handleIntent('APPEND_SCRIPT', data);

        expect(orchestrator.handleScriptAppend).toHaveBeenCalledWith({
            content: data.response.content,
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
