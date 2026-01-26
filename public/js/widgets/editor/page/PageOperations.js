export class PageOperations {
    addPage () {
        return [{ type: 'ADD_PAGE' }];
    }

    removePage (page) {
        return [{ type: 'REMOVE_PAGE', page }];
    }

    addLine (line, targetPageIndex = null, anchorLineId = null, pageLineCount = 0, maxLinesPerPage = 0) {
        if (targetPageIndex === null) {
            return [];
        }
        if (pageLineCount >= maxLinesPerPage) {
            return [
                { type: 'ADD_PAGE' },
                { type: 'ADD_LINE', line, anchorLineId: null, targetPageIndex: targetPageIndex + 1 }
            ];
        }
        return [{ type: 'ADD_LINE', line, anchorLineId, targetPageIndex }];
    }

    removeLine (line) {
        return [{ type: 'REMOVE_LINE', line }];
    }

    getLineCount (editorArea) {
        return editorArea.querySelectorAll('.script-line').length;
    }

    getNextLine (line) {
        return line ? line.nextElementSibling : null;
    }

    getPreviousLine (line) {
        return line ? line.previousElementSibling : null;
    }

    getNextPage (pages, currentPage) {
        const index = pages.indexOf(currentPage);
        return index >= 0 ? pages[index + 1] || null : null;
    }

    getPreviousPage (pages, currentPage) {
        const index = pages.indexOf(currentPage);
        return index > 0 ? pages[index - 1] : null;
    }

    getPageByIndex (pages, index) {
        return pages[index] || null;
    }

    navigateToPage (pageIndex) {
        return [{ type: 'NAVIGATE_TO_PAGE', pageIndex }];
    }

}
