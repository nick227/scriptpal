import { AuthWidget } from '../widgets/auth/AuthWidget.js';
import { ChatIntegration } from '../widgets/chat/ChatIntegration.js';
import { ScriptWidget } from '../widgets/script/ScriptWidget.js';

export class WidgetLifecycleManager {
    constructor ({ stateManager, eventManager } = {}) {
        if (!stateManager) {
            throw new Error('StateManager dependency is required for WidgetLifecycleManager');
        }
        if (!eventManager) {
            throw new Error('EventManager dependency is required for WidgetLifecycleManager');
        }
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.widgets = {};
        this.initialized = false;
    }

    async initialize (elements, dependencies) {
        if (!elements) {
            throw new Error('Elements are required for widget initialization');
        }
        if (!dependencies || !dependencies.user) {
            throw new Error('User dependency is required for widget initialization');
        }

        this.widgets.auth = new AuthWidget(
            elements,
            this.stateManager,
            dependencies.user,
            this.eventManager
        );
        await this.widgets.auth.initialize(elements);

        if (dependencies.chat) {
            const chatApi = dependencies.chat.api || dependencies.chat;
            this.widgets.chat = new ChatIntegration(
                chatApi,
                this.stateManager,
                this.eventManager
            );
            await this.widgets.chat.initialize();
        }

        if (dependencies.script) {
            this.widgets.script = new ScriptWidget(
                elements,
                this.stateManager,
                this.eventManager
            );
            await this.widgets.script.initialize(dependencies.script);
        }

        this.initialized = true;
        return this.widgets;
    }

    async update (elements, dependencies) {
        if (!elements) {
            throw new Error('Elements are required for widget updates');
        }

        if (dependencies && dependencies.chat) {
            if (!this.widgets.chat) {
                const chatApi = dependencies.chat.api || dependencies.chat;
                this.widgets.chat = new ChatIntegration(
                    chatApi,
                    this.stateManager,
                    this.eventManager
                );
                await this.widgets.chat.initialize();
            } else {
                const chatApi = dependencies.chat.api || dependencies.chat;
                if (this.widgets.chat.api !== chatApi) {
                    this.widgets.chat.destroy();
                    this.widgets.chat = new ChatIntegration(
                        chatApi,
                        this.stateManager,
                        this.eventManager
                    );
                    await this.widgets.chat.initialize();
                }
            }
        }

        if (dependencies && dependencies.script) {
            if (!this.widgets.script) {
                this.widgets.script = new ScriptWidget(
                    elements,
                    this.stateManager,
                    this.eventManager
                );
                await this.widgets.script.initialize(dependencies.script);
            } else {
                await this.widgets.script.update(dependencies.script);
            }
        }

        return this.widgets;
    }

    destroy () {
        Object.values(this.widgets).forEach((widget) => {
            if (widget) {
                widget.destroy();
            }
        });
        this.widgets = {};
        this.initialized = false;
    }

    getWidgets () {
        return this.widgets;
    }

    isInitialized () {
        return this.initialized;
    }
}
