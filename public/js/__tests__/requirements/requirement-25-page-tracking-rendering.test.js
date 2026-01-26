/**
 * Tests for Requirement #25: The system tracks and renders pages
 */

import { MAX_LINES_PER_PAGE } from '../../widgets/editor/constants.js';
import { PageManager } from '../../widgets/editor/page/PageManager.js';

describe('Requirement #25: Page Tracking and Rendering', () => {
    let pageManager;
    let editorArea;

    beforeEach(() => {
        editorArea = document.createElement('div');
        editorArea.className = 'editor-area';
        document.body.appendChild(editorArea);
        pageManager = new PageManager(editorArea);
    });

    afterEach(() => {
        pageManager.destroy();
        if (editorArea && editorArea.parentNode) {
            editorArea.parentNode.removeChild(editorArea);
        }
    });

    test('creates an initial page', async () => {
        await pageManager.initialize();
        expect(editorArea.querySelectorAll('.editor-page').length).toBe(1);
    });

    test('creates additional pages when line count exceeds capacity', async () => {
        await pageManager.initialize();
        let lastLine;
        for (let i = 0; i < MAX_LINES_PER_PAGE + 1; i++) {
            const line = document.createElement('div');
            line.className = 'script-line';
            line.textContent = `Line ${i + 1}`;
            pageManager.addLine(line);
            lastLine = line;
        }
        expect(pageManager.getPageCount()).toBe(2);
        const pages = pageManager.getPages();
        const secondPageLine = pages[1].querySelector('.script-line');
        expect(secondPageLine).toBe(lastLine);
    });

    test('keeps page order metadata consistent', async () => {
        await pageManager.initialize();
        pageManager.createNewPage();
        pageManager.createNewPage();

        pageManager.getPages().forEach((page, index) => {
            expect(page.dataset.pageIndex).toBe(String(index));
            expect(page.dataset.pageId).toBeTruthy();
        });
    });

    test('navigates to a specific page', async () => {
        await pageManager.initialize();
        pageManager.createNewPage();

        const success = pageManager.navigateToPage(1);
        expect(success).toBe(true);
        expect(pageManager.getCurrentPage()).toBe(pageManager.getPages()[1]);
    });
});
