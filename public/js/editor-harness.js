import { EditorWidget } from './widgets/editor/EditorWidget.js';

const initEditorHarness = async () => {
    const container = document.querySelector('.editor-container');
    const toolbar = document.querySelector('.editor-toolbar');

    if (!container || !toolbar) {
        throw new Error('Editor harness containers not found');
    }

    const api = {
        async updateScript (scriptId, payload) {
            return { success: true, scriptId };
        }
    };

    const user = {
        id: 'user-1',
        name: 'Harness User'
    };

    const scriptStore = {
        getCurrentScript () {
            return {
                id: 'test-script-1',
                title: 'Harness Script',
                content: '',
                versionNumber: 1
            };
        },
        async updateScript (id, payload) {
            return { id, ...payload, versionNumber: 2 };
        }
    };

    const editorWidget = new EditorWidget({ container, toolbar });
    window.editorWidget = editorWidget;

    const initialized = await editorWidget.initialize(api, user, scriptStore);
    if (!initialized) {
        throw new Error('EditorWidget failed to initialize');
    }

    const titlePage = container.querySelector('.title-page');
    if (titlePage) {
        titlePage.style.display = 'none';
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditorHarness);
} else {
    initEditorHarness();
}
