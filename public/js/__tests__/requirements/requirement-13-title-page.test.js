/**
 * Tests for Requirement #13: All scripts have a title page that persists
 * with title, author, and date.
 */

import { TitlePageManager } from '../../widgets/editor/title/TitlePageManager.js';

describe('Requirement #13: Title Page Implementation', () => {
    let titlePageManager;
    let mockContainer;
    let mockStateManager;
    let mockEventManager;
    let mockApi;
    let mockScriptStore;

    beforeEach(() => {
        mockContainer = document.createElement('div');
        mockContainer.innerHTML = `
            <div class="editor-area">
                <div class="editor-page"></div>
            </div>
        `;

        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                author: 'Test Author',
                created_at: '2023-01-01T00:00:00Z'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        mockApi = {
            updateScript: jest.fn().mockResolvedValue({ success: true })
        };

        mockScriptStore = {
            getCurrentScript: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                author: 'Test Author',
                content: '<script><action>Existing content</action></script>',
                version_number: 1
            }),
            updateScript: jest.fn().mockResolvedValue({
                id: 1,
                title: 'Test Script',
                author: 'Test Author',
                content: '<script><action>Existing content</action></script>',
                version_number: 2
            })
        };

        titlePageManager = new TitlePageManager({
            container: mockContainer,
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            api: mockApi,
            scriptStore: mockScriptStore
        });
    });

    afterEach(() => {
        titlePageManager.destroy();
    });

    test('creates title page as the first page', () => {
        titlePageManager.createTitlePage();

        const titlePage = mockContainer.querySelector('.title-page');
        const { firstChild } = mockContainer;

        expect(titlePage).toBeTruthy();
        expect(firstChild).toBe(titlePage);
    });

    test('renders title, author, and date fields', () => {
        titlePageManager.createTitlePage();
        titlePageManager.handleScriptChange(mockStateManager.getState());

        const titleInput = mockContainer.querySelector('.title-input');
        const authorInput = mockContainer.querySelector('.author-input');
        const dateInput = mockContainer.querySelector('.date-input');

        expect(titleInput.value).toBe('Test Script');
        expect(authorInput.value).toBe('Test Author');
        expect(dateInput.value).toContain('2023');
    });

    test('locks formatting by default', () => {
        titlePageManager.createTitlePage();

        const titleInput = mockContainer.querySelector('.title-input');
        const authorInput = mockContainer.querySelector('.author-input');
        const dateInput = mockContainer.querySelector('.date-input');

        expect(titleInput.readOnly).toBe(true);
        expect(authorInput.readOnly).toBe(true);
        expect(dateInput.readOnly).toBe(true);
    });

    test('persists edits via ScriptStore', async () => {
        titlePageManager.createTitlePage();
        titlePageManager.editTitlePage();

        const titleInput = mockContainer.querySelector('.title-input');
        const authorInput = mockContainer.querySelector('.author-input');

        titleInput.value = 'Updated Title';
        authorInput.value = 'Updated Author';

        await titlePageManager.saveTitlePage();

        expect(mockScriptStore.updateScript).toHaveBeenCalledWith(1, {
            title: 'Updated Title',
            author: 'Updated Author',
            content: '<script><action>Existing content</action></script>',
            version_number: 1
        });
    });

    test('restores title page data on script load', () => {
        const newScript = {
            id: 2,
            title: 'New Script',
            author: 'New Author',
            created_at: '2023-02-01T00:00:00Z'
        };

        titlePageManager.handleScriptChange(newScript);

        const titleInput = mockContainer.querySelector('.title-input');
        const authorInput = mockContainer.querySelector('.author-input');

        expect(titleInput.value).toBe('New Script');
        expect(authorInput.value).toBe('New Author');
    });
});
