import { BaseWidget } from '../../BaseWidget.js';
import { formatTypes } from '../constants.js';

export class ContentEvents extends BaseWidget {
    constructor(options) {
        super(options);
        this.eventHandlers = new Map();
        this.stateManager = options.stateManager;
        this.lineFormatter = options.lineFormatter;
        this.pageManager = options.pageManager;
        this.emitChange = options.emitChange;
    }

    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }

    off(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) return;
        const handlers = this.eventHandlers.get(eventName);
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    }

    emit(eventName, data) {
        if (!this.eventHandlers.has(eventName)) return;
        this.eventHandlers.get(eventName).forEach(handler => handler(data));
    }

    handleFormatCycle(scriptLine, direction) {
        const currentFormat = this.lineFormatter.getFormatForLine(scriptLine);
        const formatCycle = this.lineFormatter.FORMAT_CYCLE;
        const currentIndex = formatCycle.indexOf(currentFormat);

        let newFormat;
        if (direction === 'up') {
            newFormat = currentIndex === -1 ?
                formatCycle[formatCycle.length - 1] :
                formatCycle[(currentIndex - 1 + formatCycle.length) % formatCycle.length];
        } else {
            newFormat = formatCycle[(currentIndex + 1) % formatCycle.length];
        }

        if (newFormat) {
            this.lineFormatter.setLineFormat(scriptLine, newFormat);
            this.stateManager.setCurrentFormat(newFormat);
            this.emit('formatChange', newFormat);
            this.emitChange();
        }
    }

    handleMultiLineDelete(selectedLines, editorArea) {
        const firstLine = editorArea.querySelector('.script-line');
        if (selectedLines.includes(firstLine)) {
            // If first line is selected, keep it but clear its content
            firstLine.textContent = '';
            selectedLines.forEach(line => {
                if (line !== firstLine) {
                    // Use pageManager to remove lines
                    this.pageManager.removeLine(line);
                }
            });
            this.lineFormatter.setLineFormat(firstLine, formatTypes.HEADER);
            firstLine.focus();
            this.stateManager.setCurrentLine(firstLine);
        } else {
            // Get references before removal
            const prevLine = selectedLines[0].previousElementSibling;
            const nextLine = selectedLines[selectedLines.length - 1].nextElementSibling;

            // Remove all selected lines using pageManager
            selectedLines.forEach(line => {
                this.pageManager.removeLine(line);
            });

            // Focus appropriate line after deletion
            const lineToFocus = prevLine || nextLine;
            if (lineToFocus) {
                lineToFocus.focus();
                this.stateManager.setCurrentLine(lineToFocus);
            }
        }

        // Clear selection and notify of changes
        this.emit('selectionClear');

        // Emit change event for content update and autosave
        this.emitChange();

        // Mark state as needing save
        this.stateManager.markDirty(true);

        // Notify of significant content change to trigger autosave
        this.emit('contentChanged', {
            type: 'multiline-delete',
            timestamp: Date.now()
        });
    }

    handleLineDelete(line, event) {
        if (!line.textContent.trim()) {
            const firstPage = this.pageManager.state.pages[0];
            const isFirstLineOfFirstPage = firstPage &&
                line.closest('.editor-page') === firstPage &&
                firstPage.querySelector('.editor-page-content').firstElementChild === line;

            if (!isFirstLineOfFirstPage) {
                event.preventDefault();
                const currentPage = line.closest('.editor-page');
                const isLastLine = !line.nextElementSibling;
                const removed = this.pageManager.removeLine(line);
                if (isLastLine && currentPage !== firstPage) {
                    this.pageManager.deleteEmptyPage(currentPage);
                }
                return true;
            }
        }
        return false;
    }

    handleEnterKey(scriptLine, selection, nextFormat) {
        if (!selection || !selection.rangeCount) {
            const newLine = this.lineFormatter.createFormattedLine(nextFormat);
            const added = this.pageManager.addLine(newLine);
            if (added) {
                this.stateManager.setCurrentLine(newLine);
                this.stateManager.setCurrentFormat(nextFormat);
                newLine.focus();
                this.emitChange();
            }
            return true;
        }

        const range = selection.getRangeAt(0);
        const isAtEnd = range.endOffset === (range.endContainer.nodeType === Node.TEXT_NODE ?
            range.endContainer.length : range.endContainer.childNodes.length);

        const newLine = this.lineFormatter.createFormattedLine(nextFormat);

        if (!isAtEnd) {
            const remainingContent = document.createTextNode(
                range.endContainer.textContent.substring(range.endOffset)
            );
            newLine.textContent = remainingContent.textContent;
            range.endContainer.textContent = range.endContainer.textContent.substring(0, range.endOffset);
        }

        const nextSibling = scriptLine.nextElementSibling;
        const added = this.pageManager.addLine(newLine, nextSibling);

        if (added) {
            this.stateManager.setCurrentLine(newLine);
            this.stateManager.setCurrentFormat(nextFormat);
            newLine.focus();

            const newRange = document.createRange();
            const newTextNode = newLine.firstChild || newLine;
            newRange.setStart(newTextNode, 0);
            newRange.setEnd(newTextNode, 0);
            selection.removeAllRanges();
            selection.addRange(newRange);

            this.emitChange();
        }

        return true;
    }
}