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
                script: formattedScript,
                metadata: {}
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

    test('handles EDIT_SCRIPT intent with canonical response.script', async () => {
        const script = '<script><action>New content</action></script>';
        const orchestrator = {
            handleScriptEdit: jest.fn().mockResolvedValue(true)
        };
        const handler = new ScriptOperationsHandler({
            getScriptOrchestrator: () => orchestrator
        });

        await handler.handleIntent('EDIT_SCRIPT', {
            response: {
                script,
                version_number: 2
            }
        });

        expect(orchestrator.handleScriptEdit).toHaveBeenCalledWith({
            content: script,
            isFromEdit: true,
            versionNumber: 2,
            commands: undefined
        });
    });
});
