import { ScriptOrchestrator } from '../../services/script/ScriptOrchestrator.js';

describe('ScriptOrchestrator append flow', () => {
    test('splits multi-line content and appends lines', async () => {
        const eventManager = {
            subscribe: jest.fn().mockReturnValue(() => {}),
            publish: jest.fn()
        };
        const stateManager = {
            getState: jest.fn()
        };
        const scriptStore = {
            eventManager,
            stateManager
        };
        const syncService = {};
        const editorContent = {
            appendLines: jest.fn().mockResolvedValue({
                success: true,
                element: null,
                format: 'action'
            })
        };
        const editorWidget = {
            container: document.createElement('div'),
            getComponent: jest.fn().mockReturnValue(editorContent)
        };

        const orchestrator = new ScriptOrchestrator(
            scriptStore,
            syncService,
            editorWidget.container,
            editorWidget
        );

        await orchestrator.handleScriptAppend({
            content: 'INT. ROOM - DAY\nJOHN\nhello there',
            isFromAppend: true
        });

        expect(editorContent.appendLines).toHaveBeenCalledTimes(1);
        const appendedLines = editorContent.appendLines.mock.calls[0][0];
        expect(appendedLines).toHaveLength(3);
        expect(appendedLines[0]).toEqual({
            content: 'INT. ROOM - DAY',
            format: 'header'
        });
        expect(appendedLines[1]).toEqual({
            content: 'JOHN',
            format: 'speaker'
        });
        expect(appendedLines[2]).toEqual({
            content: 'hello there',
            format: 'dialog'
        });
    });
});
