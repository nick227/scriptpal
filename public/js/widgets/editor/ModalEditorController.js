export class ModalEditorController {
    constructor (options = {}) {
        this.view = options.view;
        this.adapter = options.adapter;
    }

    open (item, handlers = {}) {
        const { onSave, onAiGenerate } = handlers;
        this.view.open(item, {
            onSave: (itemId, payload) => onSave(itemId, payload),
            onAiGenerate: onAiGenerate ? this.handleAiGenerate.bind(this, onAiGenerate) : null
        });
    }

    async handleAiGenerate (onAiGenerate) {
        const itemId = this.view.getCurrentItemId();
        const payload = this.view.getFormPayload();
        this.view.setAiDisabled(true);
        try {
            const suggestion = await onAiGenerate(itemId, payload);
            if (suggestion && typeof suggestion === 'object') {
                this.adapter.applySuggestion(this.view, suggestion);
            }
        } finally {
            this.view.setAiDisabled(false);
        }
    }
}
