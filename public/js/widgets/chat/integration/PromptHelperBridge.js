import { PROMPT_REGISTRY, PROMPT_CATEGORIES } from '../../../../../shared/promptRegistry.js';
import { ROUTE_HELPERS } from '../../../../../shared/routeHelpers.js';
import { SYSTEM_PROMPTS } from '../../../../../shared/systemPrompts.js';
import { EventManager } from '../../../core/EventManager.js';
import { STATE_KEYS } from '../../../core/StateManager.js';

import { PromptHelperWidget } from '../ui/PromptHelperWidget.js';
import { SystemPromptOrchestrator } from './SystemPromptOrchestrator.js';

const SERVICE_HELPERS = PROMPT_REGISTRY
    .filter(prompt => prompt.enabled && prompt.category === PROMPT_CATEGORIES.SERVICE)
    .map(prompt => ({
        id: prompt.id,
        label: prompt.label,
        description: prompt.clientCopy,
        type: 'route',
        prompt: prompt.userPrompt,
        intent: prompt.intent
    }));

export class PromptHelperBridge {
    constructor({ api, chatManager, eventManager, stateManager, helperContainer }) {
        if (!api) throw new Error('API instance is required for PromptHelperBridge');
        if (!eventManager) throw new Error('EventManager instance is required for PromptHelperBridge');
        this.api = api;
        this.eventManager = eventManager;
        this.chatManager = chatManager;
        this.stateManager = stateManager;
        this.helperContainer = helperContainer;
        this.ui = null;
        this.orchestrator = null;
        this.subscriptions = [];
    }

    initialize() {
        if (!this.helperContainer) {
            console.warn('[PromptHelperBridge] Helper container missing');
            return;
        }

        this.ui = new PromptHelperWidget({
            container: this.helperContainer,
            sections: this.buildSections(),
            onHelperClick: this.handleHelperClick.bind(this)
        });
        this.ui.initialize();

        this.orchestrator = new SystemPromptOrchestrator({
            api: this.api,
            chatManager: this.chatManager,
            eventManager: this.eventManager
        });
        this.orchestrator.initialize();

        this.subscribe(EventManager.EVENTS.SYSTEM_PROMPT.READY, this.handlePromptReady.bind(this));
        this.subscribe(EventManager.EVENTS.SYSTEM_PROMPT.FIRED, this.handlePromptFired.bind(this));
        this.subscribe(EventManager.EVENTS.SYSTEM_PROMPT.FAILED, this.handlePromptFailed.bind(this));
    }

    buildSections() {
        const helpers = [
            ...SYSTEM_PROMPTS.map(prompt => ({
                id: prompt.id,
                label: prompt.label,
                description: prompt.clientCopy,
                type: 'system'
            })),
            ...SERVICE_HELPERS,
            ...ROUTE_HELPERS
        ];

        const uniqueHelpers = Array.from(
            new Map(helpers.map(h => [h.label, h])).values()
        );

        return [
            {
                id: 'all-prompts',
                helpers: uniqueHelpers
            }
        ];
    }

    handleHelperClick(sectionId, helper) {
        if (!helper) {
            return;
        }

        if (helper.type === 'system') {
            this.fireSystemPrompt(helper.id);
            return;
        }

        this.sendManualRoutePrompt(helper);
    }

    fireSystemPrompt(promptId) {
        const script = this.stateManager?.getState?.(STATE_KEYS.CURRENT_SCRIPT) || null;
        const scriptId = script ? script.id : null;
        this.orchestrator?.firePrompt(promptId, scriptId, { manual: true })
            .catch(error => console.error('[PromptHelperBridge] System prompt failed:', error));
    }

    sendManualRoutePrompt(helper) {
        if (!this.chatManager) {
            console.warn('[PromptHelperBridge] ChatManager missing for manual prompt');
            return;
        }

        const text = this.normalizePrompt(helper.prompt || helper.description || helper.label);
        if (!text) {
            return;
        }

        this.chatManager.handleSend(text);
    }

    normalizePrompt(value) {
        if (!value || typeof value !== 'string') {
            return '';
        }

        return value
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join(' ');
    }

    subscribe(event, handler) {
        const unsub = this.eventManager.subscribe(event, handler);
        if (typeof unsub === 'function') {
            this.subscriptions.push(unsub);
        }
    }

    handlePromptReady() {
        this.ui?.showSpinner();
        this.ui?.updateIndicator('✓');
    }

    handlePromptFired() {
        this.ui?.hideSpinner();
        this.ui?.updateIndicator('-');
    }

    handlePromptFailed() {
        this.ui?.hideSpinner();
        this.ui?.updateIndicator('E');
    }

    destroy() {
        if (this.orchestrator) {
            this.orchestrator.destroy();
            this.orchestrator = null;
        }

        if (this.ui) {
            this.ui.destroy();
            this.ui = null;
        }

        this.subscriptions.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this.subscriptions = [];
    }
}
