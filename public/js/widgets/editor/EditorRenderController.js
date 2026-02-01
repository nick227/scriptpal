/**
 * Handles DOM rendering and incremental updates.
 */
export class EditorRenderController {
    constructor ({ domHandler, pageManager }) {
        this.domHandler = domHandler;
        this.pageManager = pageManager;
    }

    async renderDocument (document, options = {}) {
        if (!this.domHandler) {
            return false;
        }
        return this.domHandler.renderDocument(document, options);
    }

    updateLineById (lineId, updates = {}) {
        if (!this.domHandler) {
            return;
        }
        this.domHandler.updateLineById(lineId, updates);
    }

    appendLine (line) {
        if (!this.domHandler) {
            return;
        }
        this.domHandler.appendLine(line);
    }

    removeLineById (lineId) {
        if (!this.domHandler) {
            return;
        }
        this.domHandler.removeLineById(lineId);
    }

    focusLineById (lineId, options = {}) {
        if (!this.domHandler) {
            return null;
        }
        return this.domHandler.focusLineById(lineId, options);
    }

    getCurrentLine () {
        if (!this.domHandler) {
            return null;
        }
        return this.domHandler.getCurrentLine();
    }
}
