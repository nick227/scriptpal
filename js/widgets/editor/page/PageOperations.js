export class PageOperations {
    constructor(measurement) {
        this.measurement = measurement;
        this._rebalanceTimeout = null;
        this._pendingOperations = new Map();
    }

    addLine(page, line, afterLine = null) {
        if (!page || !line) return false;

        const operation = {
            type: 'add',
            page,
            line,
            afterLine
        };

        this._queueOperation(operation);
        return true;
    }

    removeLine(line) {
        if (!line || !line.parentElement) return false;

        const operation = {
            type: 'remove',
            page: line.parentElement,
            line
        };

        this._queueOperation(operation);
        return true;
    }

    moveLine(line, targetPage, afterLine = null) {
        if (!line || !targetPage) return false;

        const operation = {
            type: 'move',
            page: targetPage,
            line,
            afterLine
        };

        this._queueOperation(operation);
        return true;
    }

    _queueOperation(operation) {
        const pageId = operation.page.dataset.pageNumber;
        if (!this._pendingOperations.has(pageId)) {
            this._pendingOperations.set(pageId, []);
        }
        this._pendingOperations.get(pageId).push(operation);

        this._scheduleProcessing();
    }

    _scheduleProcessing() {
        if (this._rebalanceTimeout) {
            clearTimeout(this._rebalanceTimeout);
        }

        this._rebalanceTimeout = setTimeout(() => {
            this._processOperations();
        }, 100);
    }

    _processOperations() {
        const pages = Array.from(this._pendingOperations.keys()).sort();

        // Process operations page by page
        pages.forEach(pageId => {
            const operations = this._pendingOperations.get(pageId);
            operations.forEach(operation => {
                switch (operation.type) {
                    case 'add':
                        this._executeAdd(operation);
                        break;
                    case 'remove':
                        this._executeRemove(operation);
                        break;
                    case 'move':
                        this._executeMove(operation);
                        break;
                }
            });
        });

        this._pendingOperations.clear();
        this._rebalanceTimeout = null;
    }

    _executeAdd(operation) {
        const { page, line, afterLine } = operation;

        if (afterLine) {
            afterLine.after(line);
        } else {
            page.appendChild(line);
        }

        this.measurement.invalidatePageCache(page);
    }

    _executeRemove(operation) {
        const { page, line } = operation;

        line.remove();
        this.measurement.invalidatePageCache(page);
    }

    _executeMove(operation) {
        const { page, line, afterLine } = operation;
        const sourcePage = line.parentElement;

        if (afterLine) {
            afterLine.after(line);
        } else {
            page.appendChild(line);
        }

        if (sourcePage) {
            this.measurement.invalidatePageCache(sourcePage);
        }
        this.measurement.invalidatePageCache(page);
    }

    destroy() {
        if (this._rebalanceTimeout) {
            clearTimeout(this._rebalanceTimeout);
        }
        this._pendingOperations.clear();
    }
}