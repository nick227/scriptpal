export class LineFormatter {
    constructor(stateManager) {
        if (!stateManager) {
            throw new Error('StateManager is required for LineFormatter');
        }

        this.stateManager = stateManager;

        this.formats = Object.freeze({
            HEADER: 'header',
            ACTION: 'action',
            SPEAKER: 'speaker',
            DIALOG: 'dialog',
            DIRECTIONS: 'directions'
        });

        // Format flow: HEADER -> ACTION -> SPEAKER -> DIALOG -> SPEAKER -> DIALOG (cycles)
        // Special formats (ACTION, DIRECTIONS) require explicit selection
        this.stateManager.setFormatFlow(Object.freeze({
            // Natural flow
            [this.formats.HEADER]: this.formats.ACTION,
            [this.formats.ACTION]: this.formats.SPEAKER,
            [this.formats.SPEAKER]: this.formats.DIALOG,
            [this.formats.DIALOG]: this.formats.SPEAKER,
            [this.formats.DIRECTIONS]: this.formats.ACTION,
        }));

        // Format cycling (for shift+arrow keys)
        this.stateManager.setFormatCycle(Object.freeze([
            this.formats.ACTION,
            this.formats.SPEAKER,
            this.formats.DIALOG,
            this.formats.HEADER,
            this.formats.DIRECTIONS
        ]));

        this._resizeObserver = null;
        this._mutationObserver = null;
        this._fullPageCheckTimeout = null;
    }

    // Get next format in natural flow (for Enter key)
    getNextFlowFormat(currentFormat) {
        const formatFlow = this.stateManager.getFormatFlow();
        return formatFlow[currentFormat] || this.formats.ACTION;
    }

    // Get next/previous format in cycle (for shift+arrow keys)
    cycleFormat(currentFormat, direction = 'next') {
        const formatCycle = this.stateManager.getFormatCycle();
        const currentIndex = formatCycle.indexOf(currentFormat);
        if (currentIndex === -1) return this.formats.ACTION;

        const cycleLength = formatCycle.length;
        if (direction === 'next') {
            return formatCycle[(currentIndex + 1) % cycleLength];
        } else {
            return formatCycle[(currentIndex - 1 + cycleLength) % cycleLength];
        }
    }

    // Line Management
    createFormattedLine(format) {
        // If no format is provided, check if this is the first line
        if (!format) {
            const pages = this.stateManager.getPages();
            const isFirstLine = !pages.length || (pages.length === 1 && !pages[0].querySelector('.script-line'));
            format = isFirstLine ? this.formats.HEADER : this.formats.ACTION;
        }

        const line = document.createElement('div');
        line.className = 'script-line';
        line.contentEditable = 'true';
        line.setAttribute('role', 'textbox');
        line.setAttribute('aria-multiline', 'false');
        line.setAttribute('data-format', format);

        // Ensure line has a text node
        line.appendChild(document.createTextNode(''));

        // Set format class
        this.setLineFormat(line, format);

        return line;
    }

    getFormatForLine(line) {
        if (!line || !line.classList) return null;
        return Object.values(this.formats).find(format =>
            line.classList.contains(`format-${format}`)) || null;
    }

    setLineFormat(line, format) {
        if (!line || !line.classList || !this.isValidFormat(format)) return line;

        // Remove existing format classes
        Object.values(this.formats).forEach(fmt =>
            line.classList.remove(`format-${fmt}`));

        // Add new format class and ensure script-line class exists
        line.classList.add('script-line');
        line.classList.add(`format-${format}`);
        line.setAttribute('data-format', format);

        // Ensure contentEditable is set
        line.contentEditable = 'true';

        // Update state
        this.stateManager.setCurrentFormat(format);

        return line;
    }

    // Utility Methods
    isValidFormat(format) {
        return Object.values(this.formats).includes(format);
    }

    getAllFormats() {
        return Object.values(this.formats);
    }

    getFormatName(format) {
        if (!this.isValidFormat(format)) return '';
        const entry = Object.entries(this.formats)
            .find(([_, value]) => value === format);
        return entry && entry[0] ? entry[0].toLowerCase() : '';
    }

    handleInput() {
        // Get current line from state
        const currentLine = this.stateManager.getCurrentLine();
        if (!currentLine) return;

        // Check for overflow
        if (currentLine.parentElement) {
            requestAnimationFrame(() => {
                this.checkCurrentLineOverflow(currentLine);
            });
        }

        // Update state
        this.stateManager.setState('pendingChanges', true);
        this.scheduleFullPageCheck();
    }

    scheduleFullPageCheck() {
        // Debounce the full page check
        if (this._fullPageCheckTimeout) {
            clearTimeout(this._fullPageCheckTimeout);
        }

        this._fullPageCheckTimeout = setTimeout(() => {
            const pages = this.stateManager.getPages();
            pages.forEach(page => {
                if (page.scrollHeight > page.clientHeight) {
                    this.moveContentToNextPage(page.lastElementChild);
                }
            });
        }, 300);
    }

    checkCurrentLineOverflow(line) {
        const page = line.parentElement;
        if (page && page.scrollHeight > page.clientHeight) {
            this.moveContentToNextPage(line);
        }
    }

    moveContentToNextPage(fromLine) {
        const fragment = document.createDocumentFragment();
        let nextLine = fromLine.nextSibling;
        let hasContent = false;

        while (nextLine) {
            const lineToMove = nextLine;
            nextLine = nextLine.nextSibling;
            fragment.appendChild(lineToMove);
            hasContent = true;
        }

        if (hasContent) {
            const pages = this.stateManager.getPages();
            const currentPageIndex = pages.indexOf(fromLine.parentElement);

            if (currentPageIndex >= 0) {
                const nextPage = pages[currentPageIndex + 1] || this.createNewPage();
                nextPage.appendChild(fragment);
                this.stateManager.setPageCount(pages.length);
            }
        }
    }

    handleEnterKey(e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();

            // Get current line and validate
            const currentLine = this.stateManager.getCurrentLine();
            if (!currentLine || !currentLine.parentElement) return true;

            try {
                // Get current selection and range safely
                let cursorOffset = 0;
                let selectionInCurrentLine = false;

                const selection = window.getSelection();
                if (selection && typeof selection.getRangeCount === 'function' && selection.getRangeCount() > 0) {
                    const range = selection.getRangeAt(0);
                    if (range && currentLine.contains(range.startContainer)) {
                        cursorOffset = range.startOffset;
                        selectionInCurrentLine = true;
                    }
                }

                // Get text content
                const lineContent = currentLine.textContent || '';
                const beforeCursor = selectionInCurrentLine ? lineContent.substring(0, cursorOffset) : lineContent;
                const afterCursor = selectionInCurrentLine ? lineContent.substring(cursorOffset) : '';

                // Update current line with text before cursor
                if (currentLine.firstChild) {
                    currentLine.firstChild.textContent = beforeCursor;
                } else {
                    currentLine.appendChild(document.createTextNode(beforeCursor));
                }

                // Get format for new line
                const currentFormat = this.getFormatForLine(currentLine);
                const nextFormat = this.getNextFlowFormat(currentFormat);

                // Create new line with text after cursor
                const newLine = this.createFormattedLine(nextFormat);
                if (afterCursor) {
                    newLine.firstChild.textContent = afterCursor;
                }

                // Insert new line after current
                currentLine.parentElement.insertBefore(newLine, currentLine.nextSibling);

                // Set focus and cursor position
                requestAnimationFrame(() => {
                    try {
                        // Create and apply new range
                        const newRange = document.createRange();
                        newRange.setStart(newLine.firstChild, 0);
                        newRange.setEnd(newLine.firstChild, 0);

                        // Update selection
                        const newSelection = window.getSelection();
                        if (newSelection) {
                            newSelection.removeAllRanges();
                            newSelection.addRange(newRange);
                        }

                        // Set focus
                        newLine.focus();

                        // Update state
                        this.stateManager.setCurrentLine(newLine);

                        // Check for overflow after DOM update
                        this.checkCurrentLineOverflow(newLine);
                    } catch (focusError) {
                        console.warn('Error setting focus:', focusError);
                        // Even if focus fails, ensure line is in state
                        this.stateManager.setCurrentLine(newLine);
                    }
                });

                return true;
            } catch (error) {
                console.error('Error handling Enter key:', error);
                return true; // Prevent default even if we fail
            }
        }
        return false;
    }

    // Add efficient page monitoring
    setupPageMonitoring() {
        this._resizeObserver = new ResizeObserver(entries => {
            const metrics = this.stateManager.getPageMetrics();

            for (const entry of entries) {
                metrics.set(entry.target, {
                    scrollHeight: entry.target.scrollHeight,
                    clientHeight: entry.target.clientHeight
                });
            }

            this.stateManager.setPageMetrics(metrics);
        });

        this._mutationObserver = new MutationObserver(() => {
            const currentLine = this.stateManager.getCurrentLine();
            if (currentLine) {
                requestAnimationFrame(() => this.checkCurrentLineOverflow(currentLine));
            }
        });
    }

    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }

        if (this._mutationObserver) {
            this._mutationObserver.disconnect();
            this._mutationObserver = null;
        }

        if (this._fullPageCheckTimeout) {
            clearTimeout(this._fullPageCheckTimeout);
            this._fullPageCheckTimeout = null;
        }
    }
}