export class LineFormatter {
    constructor(stateManager) {
        if (!stateManager) {
            throw new Error('StateManager is required for LineFormatter');
        }

        this.stateManager = stateManager;
        this.keydownHandler = null; // Store keydown handler reference

        this.formats = Object.freeze({
            HEADER: 'header',
            ACTION: 'action',
            SPEAKER: 'speaker',
            DIALOG: 'dialog',
            DIRECTIONS: 'directions'
        });

        // Format flow defines the exact pattern:
        // HEADER -> ACTION -> SPEAKER -> DIALOG <-> SPEAKER
        this.formatFlow = {
            [this.formats.HEADER]: this.formats.ACTION,
            [this.formats.ACTION]: this.formats.SPEAKER,
            [this.formats.SPEAKER]: this.formats.DIALOG,
            [this.formats.DIALOG]: this.formats.SPEAKER
        };

        // Format cycling (for shift+arrow keys)
        this.formatCycle = [
            this.formats.ACTION,
            this.formats.SPEAKER,
            this.formats.DIALOG,
            this.formats.HEADER,
            this.formats.DIRECTIONS
        ];

        this._resizeObserver = null;
        this._mutationObserver = null;
        this._fullPageCheckTimeout = null;
    }

    setKeydownHandler(handler) {
        this.keydownHandler = handler;
    }

    handleShiftArrowKeys(event) {
        const currentFormat = this.getFormatForLine(this.stateManager.getCurrentLine());
        const nextFormat = this.cycleFormat(currentFormat, event.key === 'ArrowDown' ? 'next' : 'prev');
        this.setLineFormat(this.stateManager.getCurrentLine(), nextFormat);
    }

    // Get next format in natural flow (for Enter key)
    getNextFlowFormat(currentFormat) {
        if (!currentFormat) {
            return this.formats.HEADER;
        }

        // Get the next format from the flow map
        const nextFormat = this.formatFlow[currentFormat];

        // If no next format defined, stay in current format (for DIRECTIONS)
        if (!nextFormat) {
            return this.formats.ACTION;
        }

        return nextFormat;
    }

    // Get next/previous format in cycle (for shift+arrow keys)
    cycleFormat(currentFormat, direction = 'next') {
        const currentIndex = this.formatCycle.indexOf(currentFormat);
        if (currentIndex === -1) return this.formats.ACTION;

        const cycleLength = this.formatCycle.length;
        if (direction === 'next') {
            return this.formatCycle[(currentIndex + 1) % cycleLength];
        } else {
            return this.formatCycle[(currentIndex - 1 + cycleLength) % cycleLength];
        }
    }

    // Line Management
    createFormattedLine(format = null) {
        if (!format) {
            const currentLine = this.stateManager.getCurrentLine();
            if (currentLine) {
                const currentFormat = this.getFormatForLine(currentLine);
                format = this.getNextFlowFormat(currentFormat);
                console.log('LineFormatter: Determined format from current line:', {
                    currentLine,
                    currentFormat,
                    nextFormat: format
                });
            } else {
                format = this.formats.HEADER;
            }
        }

        // Create new line element
        const line = document.createElement('div');
        line.className = 'script-line';
        line.contentEditable = 'true';
        line.setAttribute('data-format', format);
        line.classList.add(`format-${format}`);

        // Attach keydown handler if available
        if (this.keydownHandler) {
            line.addEventListener('keydown', this.keydownHandler);
        }

        // Ensure line has initial text node for cursor positioning
        const textNode = document.createTextNode('');
        line.appendChild(textNode);

        return line;
    }

    getFormatForLine(line) {
        if (!line || !line.classList) {
            console.warn('LineFormatter: Invalid line for format check:', line);
            return null;
        }
        const format = line.getAttribute('data-format') || null;

        return format;
    }

    setLineFormat(line, format) {
        console.log('LineFormatter: Setting format:', {
            line,
            currentFormat: line.getAttribute('data-format'),
            newFormat: format
        });

        if (!line || !line.classList || !this.isValidFormat(format)) {
            console.warn('LineFormatter: Invalid line or format:', { line, format });
            return line;
        }

        // Remove existing format classes
        Object.values(this.formats).forEach(fmt =>
            line.classList.remove(`format-${fmt}`));

        // Add new format class
        line.classList.add(`format-${format}`);
        line.setAttribute('data-format', format);

        // Update state manager
        const currentLine = this.stateManager.getCurrentLine();
        const isCurrentLine = line === currentLine;
        console.log('LineFormatter: Format update:', {
            isCurrentLine,
            oldFormat: currentLine && currentLine.getAttribute('data-format'),
            newFormat: format
        });

        if (isCurrentLine) {
            this.stateManager.setCurrentFormat(format);
        }

        return line;
    }

    // Utility Methods
    isValidFormat(format) {
        const isValid = Object.values(this.formats).includes(format);

        return isValid;
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

    handleEnterKey(event) {
        event.preventDefault();

        const currentLine = this.stateManager.getCurrentLine();
        if (!currentLine) return false;

        // Get current format and next format in flow
        const currentFormat = this.getFormatForLine(currentLine);
        const nextFormat = this.getNextFlowFormat(currentFormat);

        // Create new line with next format
        const newLine = this.createFormattedLine(nextFormat);
        console.log('LineFormatter: Created new line with format:', nextFormat);

        // Handle text split at cursor position
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            // Ensure we're working with the correct text node
            let container = range.commonAncestorContainer;
            if (container.nodeType !== Node.TEXT_NODE) {
                container = Array.from(currentLine.childNodes)
                    .find(node => node.nodeType === Node.TEXT_NODE && node.textContent.length > 0) || currentLine.firstChild;
            }

            if (currentLine.contains(container)) {
                // Get text content before and after cursor
                const fullText = container.textContent;
                const cursorPosition = range.startOffset;
                const textBefore = fullText.substring(0, cursorPosition);
                const textAfter = fullText.substring(cursorPosition);

                // Update text content
                container.textContent = textBefore;
                newLine.textContent = textAfter;

                console.log('LineFormatter: Split text at cursor:', {
                    before: textBefore,
                    after: textAfter,
                    position: cursorPosition
                });
            }
        }

        // Get the parent page
        const currentPage = currentLine.parentElement;
        if (!currentPage) return false;

        // Insert new line after current line
        currentPage.insertBefore(newLine, currentLine.nextSibling);
        console.log('LineFormatter: Inserted new line after current line');

        // Set focus to new line
        requestAnimationFrame(() => {
            newLine.focus();

            // Place cursor at start of new line
            const selection = window.getSelection();
            if (selection) {
                const range = document.createRange();
                const textNode = newLine.firstChild || newLine;
                range.setStart(textNode, 0);
                range.setEnd(textNode, 0);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            // Check for page overflow
            this.checkCurrentLineOverflow(newLine);
        });

        return true;
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