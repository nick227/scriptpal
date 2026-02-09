/**
 * Shared page redistribution utility.
 * Moves overflowing lines between pages based on pixel height (scrollHeight > clientHeight).
 * Used by both /mine (editor) and /public (viewer) for consistent script layout.
 */

/**
 * Split lines into chunks of maxPerPage size.
 * @param {Array} lines
 * @param {number} maxPerPage
 * @returns {Array<Array>}
 */
export function chunkLines (lines, maxPerPage) {
    const chunks = [];
    for (let i = 0; i < lines.length; i += maxPerPage) {
        chunks.push(lines.slice(i, i + maxPerPage));
    }
    return chunks;
}

/**
 * Create a page DOM shell: { page, content }.
 * Keeps structure identical between editor and viewer.
 * @returns {{ page: HTMLElement, content: HTMLElement }}
 */
export function createPageShell () {
    const page = document.createElement('div');
    page.className = 'editor-page';

    const content = document.createElement('div');
    content.className = 'editor-page-content';

    page.appendChild(content);
    return { page, content };
}

const getContentContainer = (page) =>
    page.querySelector('.editor-page-content') || page.querySelector('.page-content');

/**
 * Redistribute overflowing content across pages based on pixel height.
 * Moves lines from pages where scrollHeight > clientHeight to the next page.
 * Loops until stable so cascading overflow is resolved.
 *
 * @param {object} options
 * @param {() => HTMLElement[]} options.getPages - Returns array of page elements in order
 * @param {() => HTMLElement | null} options.createNewPage - Creates and inserts a new page; returns the page element
 * @param {() => void} [options.onPagesChanged] - Called after redistribution (e.g. rebuild line map)
 */
export function redistributeOverflowingContent (options) {
    const { getPages, createNewPage, onPagesChanged } = options;
    let changed = true;

    while (changed) {
        changed = false;
        const pages = getPages();
        if (!pages.length) {
            return;
        }

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const page = pages[pageIndex];
            const content = getContentContainer(page);
            if (!content) {
                continue;
            }

            if (content.scrollHeight <= content.clientHeight) {
                continue;
            }

            while (content.scrollHeight > content.clientHeight) {
                const lastLine = content.lastElementChild;
                if (!lastLine || !lastLine.classList.contains('script-line')) {
                    break;
                }

                let nextPage = pages[pageIndex + 1];
                if (!nextPage) {
                    nextPage = createNewPage();
                    if (!nextPage) {
                        break;
                    }
                }

                const nextContent = getContentContainer(nextPage);
                if (!nextContent) {
                    break;
                }

                nextContent.insertBefore(lastLine, nextContent.firstChild);
                changed = true;
            }
        }
    }

    if (typeof onPagesChanged === 'function') {
        onPagesChanged();
    }
}
