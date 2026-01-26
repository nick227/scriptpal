import { MAX_LINES_PER_PAGE } from '../../../widgets/editor/constants.js';
import { PageManager } from '../../../widgets/editor/page/PageManager.js';

describe('PageManager - Page Tracking and Rendering', () => {
    let pageManager;
    let mockEditorArea;

    beforeEach(() => {
        mockEditorArea = document.createElement('div');
        mockEditorArea.className = 'editor-area';
        document.body.appendChild(mockEditorArea);

        pageManager = new PageManager(mockEditorArea);
    });

    afterEach(() => {
        pageManager.destroy();
        if (mockEditorArea && mockEditorArea.parentNode) {
            mockEditorArea.parentNode.removeChild(mockEditorArea);
        }
    });

    test('initializes with defaults', () => {
        expect(pageManager.getPageCount()).toBe(0);
        expect(pageManager.getPages()).toEqual([]);
        expect(pageManager.getCurrentPage()).toBeNull();
    });

    test('creates the initial page on initialize', async () => {
        await pageManager.initialize();
        expect(pageManager.getPageCount()).toBe(1);
        expect(pageManager.getCurrentPage()).toBeTruthy();
    });

    test('creates pages with expected structure', async () => {
        await pageManager.initialize();
        const page = pageManager.getPages()[0];
        expect(page.classList.contains('editor-page')).toBe(true);
        expect(page.dataset.pageId).toBeDefined();
        expect(page.querySelector('.editor-page-content')).toBeTruthy();
    });

    test('updates page count on add/remove', async () => {
        await pageManager.initialize();
        pageManager.createNewPage();
        expect(pageManager.getPageCount()).toBe(2);

        pageManager.removePage(pageManager.getPages()[1]);
        expect(pageManager.getPageCount()).toBe(1);
    });

    test('adds and removes lines', async () => {
        await pageManager.initialize();
        const line = document.createElement('div');
        line.className = 'script-line';
        line.textContent = 'Test line';

        pageManager.addLine(line);
        expect(pageManager.getCurrentPage().querySelector('.script-line')).toBe(line);

        pageManager.removeLine(line);
        expect(pageManager.getCurrentPage().querySelector('.script-line')).toBeNull();
    });

    test('creates a new page when current page is full', async () => {
        await pageManager.initialize();
        for (let i = 0; i < MAX_LINES_PER_PAGE; i++) {
            const line = document.createElement('div');
            line.className = 'script-line';
            line.textContent = `Line ${i + 1}`;
            pageManager.addLine(line);
        }

        const extraLine = document.createElement('div');
        extraLine.className = 'script-line';
        extraLine.textContent = 'Extra line';
        pageManager.addLine(extraLine);

        expect(pageManager.getPageCount()).toBe(2);
    });

    test('navigates between pages', async () => {
        await pageManager.initialize();
        pageManager.createNewPage();

        const firstPage = pageManager.getPages()[0];
        const secondPage = pageManager.getPages()[1];

        expect(pageManager.getNextPage(firstPage)).toBe(secondPage);
        expect(pageManager.getPreviousPage(secondPage)).toBe(firstPage);
    });

    test('maintains page order metadata', async () => {
        await pageManager.initialize();
        pageManager.createNewPage();
        pageManager.createNewPage();

        pageManager.getPages().forEach((page, index) => {
            expect(page.dataset.pageIndex).toBe(String(index));
            expect(page.dataset.pageId).toBeTruthy();
        });
    });

    test('notifies page count changes', async () => {
        await pageManager.initialize();
        const handler = jest.fn();
        pageManager.onPageCountChange(handler);

        pageManager.createNewPage();
        expect(handler).toHaveBeenCalledWith(2);
    });

    test('notifies page changes', async () => {
        await pageManager.initialize();
        const handler = jest.fn();
        pageManager.onPageChange(handler);

        const secondPage = pageManager.createNewPage();
        pageManager.setCurrentPage(secondPage);
        expect(handler).toHaveBeenCalledWith(secondPage);
    });

    test('validates state without errors', async () => {
        await pageManager.initialize();
        expect(pageManager.validateState()).toBe(true);
    });
});
