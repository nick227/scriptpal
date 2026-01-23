import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';

import { SystemPromptOrchestrator } from './SystemPromptOrchestrator.js';
import { SystemPromptUI } from './SystemPromptUI.js';

export class SystemPromptBridge {
    constructor ({ api, chatManager, eventManager, stateManager, container }) {
        this.api = api;
        this.chatManager = chatManager;
        this.eventManager = eventManager;
        this.stateManager = stateManager;
        this.container = container;
        this.ui = new SystemPromptUI({
            container,
            onPromptClick: this.handlePromptClick.bind(this)
        });
        this.orchestrator = null;
        this.eventUnsubscribers = [];
    }

    initialize () {
        this.ui.initialize();

        this.orchestrator = new SystemPromptOrchestrator({
            api: this.api,
            chatManager: this.chatManager,
            eventManager: this.eventManager
        });
        this.orchestrator.initialize();

        const readyUnsub = this.eventManager.subscribe(
            EventManager.EVENTS.SYSTEM_PROMPT.READY,
            this.handlePromptReady.bind(this)
        );
        const firedUnsub = this.eventManager.subscribe(
            EventManager.EVENTS.SYSTEM_PROMPT.FIRED,
            this.handlePromptFired.bind(this)
        );
        const failedUnsub = this.eventManager.subscribe(
            EventManager.EVENTS.SYSTEM_PROMPT.FAILED,
            this.handlePromptFailed.bind(this)
        );

        if (typeof readyUnsub === 'function') {
            this.eventUnsubscribers.push(readyUnsub);
        }
        if (typeof firedUnsub === 'function') {
            this.eventUnsubscribers.push(firedUnsub);
        }
        if (typeof failedUnsub === 'function') {
            this.eventUnsubscribers.push(failedUnsub);
        }
    }

    handlePromptClick (promptId) {
        if (!this.orchestrator) {
            return;
        }
        const script = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        const scriptId = script ? script.id : null;
        this.orchestrator.firePrompt(promptId, scriptId, { manual: true })
            .catch(error => {
                console.error('[ChatIntegration] Manual system prompt failed:', error);
            });
    }

    handlePromptReady () {
        this.ui.showSpinner();
        this.ui.updateIndicator('✔️');
    }

    handlePromptFired () {
        this.ui.hideSpinner();
        this.ui.updateIndicator('-');
    }

    handlePromptFailed () {
        this.ui.hideSpinner();
        this.ui.updateIndicator('e');
    }

    destroy () {
        if (this.orchestrator) {
            this.orchestrator.destroy();
            this.orchestrator = null;
        }

        this.ui.destroy();

        this.eventUnsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.eventUnsubscribers = [];
    }
}
