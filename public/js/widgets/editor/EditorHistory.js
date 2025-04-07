export class EditorHistory {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;
        this.stateChangeHandler = null;
        this.currentContent = '';
        this.isProcessing = false;
    }

    async initialize() {
        // Initialize with empty state
        this.saveState('');
    }

    saveState(content) {
        // Don't save if content hasn't changed or we're processing undo/redo
        if (content === this.currentContent || this.isProcessing) {
            return;
        }

        // Save current state
        this.undoStack.push(this.currentContent);
        this.currentContent = content;

        // Clear redo stack when new changes are made
        this.redoStack = [];

        // Maintain stack size limit
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }

        this.notifyStateChange();
    }

    undo() {
        if (!this.canUndo()) return null;

        this.isProcessing = true;
        try {
            // Move current content to redo stack
            this.redoStack.push(this.currentContent);

            // Get previous state
            const previousContent = this.undoStack.pop();
            this.currentContent = previousContent;

            this.notifyStateChange();
            return previousContent;
        } finally {
            this.isProcessing = false;
        }
    }

    redo() {
        if (!this.canRedo()) return null;

        this.isProcessing = true;
        try {
            // Move current content to undo stack
            this.undoStack.push(this.currentContent);

            // Get next state
            const nextContent = this.redoStack.pop();
            this.currentContent = nextContent;

            this.notifyStateChange();
            return nextContent;
        } finally {
            this.isProcessing = false;
        }
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    getCurrentContent() {
        return this.currentContent;
    }

    onStateChange(callback) {
        this.stateChangeHandler = callback;
    }

    notifyStateChange() {
        if (this.stateChangeHandler) {
            this.stateChangeHandler({
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                currentContent: this.currentContent
            });
        }
    }

    reset() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentContent = '';
        this.isProcessing = false;
        this.notifyStateChange();
    }

    destroy() {
        this.reset();
        this.stateChangeHandler = null;
    }
}