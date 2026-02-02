/**
 * Handles DOM rendering and incremental updates.
 */
export class EditorRenderController {
    /**
     *
     * @param root0
     * @param root0.domHandler
     * @param root0.pageManager
     */
    constructor ({ domHandler, pageManager }) {
        this.domHandler = domHandler;
        this.pageManager = pageManager;
    }

    /**
     *
     * @param document
     * @param options
     */
    async renderDocument (document, options = {}) {
        if (!this.domHandler) {
            return false;
        }
        return this.domHandler.renderDocument(document, options);
    }

    /**
     *
     * @param lineId
     * @param updates
     */
    updateLineById (lineId, updates = {}) {
        if (!this.domHandler) {
            return;
        }
        this.domHandler.updateLineById(lineId, updates);
    }

    /**
     *
     * @param line
     */
    appendLine (line) {
        if (!this.domHandler) {
            return;
        }
        this.domHandler.appendLine(line);
    }

    /**
     *
     * @param lineId
     */
    removeLineById (lineId) {
        if (!this.domHandler) {
            return;
        }
        this.domHandler.removeLineById(lineId);
    }

    /**
     *
     * @param lineId
     * @param options
     */
    placeCaret (lineId, options = {}) {
        if (!this.domHandler) {
            return null;
        }
        return this.domHandler.placeCaret(lineId, options);
    }

    /**
     *
     */
    getCurrentLine () {
        if (!this.domHandler) {
            return null;
        }
        return this.domHandler.getCurrentLine();
    }
}
