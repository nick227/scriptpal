import { BaseEvents } from '../../core/BaseEvents.js';

export class ChatEvents extends BaseEvents {
    constructor(handlers) {
        super();
        this.handlers = handlers;
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    setupEvents() {
        if (!this.elements.input || !this.elements.sendButton) {
            console.warn('Required chat elements not found');
            return;
        }

        this.elements.sendButton.addEventListener('click', this.handleSubmit);
        this.elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit();
            }
        });
    }

    handleSubmit() {
        const message = this.elements.input.value.trim();
        if (message && this.handlers.handleSend) {
            this.handlers.handleSend(message);
            this.elements.input.value = '';
        }
    }

    cleanup() {
        if (this.elements.sendButton) {
            this.elements.sendButton.removeEventListener('click', this.handleSubmit);
        }
    }
}