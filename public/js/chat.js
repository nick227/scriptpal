import { CONFIG } from './config.js';

export class ScriptPalChat {
    constructor(api, user) {
        this.api = api;
        this.user = user;
        this.messages = null;
        this.ui = null;
    }

    setUI(ui) {
        this.ui = ui;
    }

    async initialize() {
        this.messages = [];
    }

    getMessages() {
        return [...this.messages];
    }

    clearMessages() {
        this.messages = [];
    }
}