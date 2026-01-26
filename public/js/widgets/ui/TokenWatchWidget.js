import { BaseWidget } from '../BaseWidget.js';
import { StateManager } from '../../core/StateManager.js';
import { EventManager } from '../../core/EventManager.js';

const POLL_INTERVAL = 30000;

export class TokenWatchWidget extends BaseWidget {
    constructor (elements = {}, api, stateManager, eventManager) {
        super(elements);
        if (!elements.container) {
            throw new Error('Token watch container is required');
        }
        if (!api) {
            throw new Error('API service is required for token watch');
        }
        if (!stateManager) {
            throw new Error('StateManager is required for token watch');
        }
        if (!eventManager) {
            throw new Error('EventManager is required for token watch');
        }

        this.api = api;
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.container = elements.container;
        this.valueElement = this.container.querySelector('.token-watch__tokens');
        this.costElement = this.container.querySelector('.token-watch__cost');
        this.pollHandle = null;
        this.isFetching = false;
    }

    async initialize () {
        await super.initialize();
        this.container.style.display = 'none';
        this.handleAuthState(this.stateManager.getState(StateManager.KEYS.AUTHENTICATED));
    }

    setupEventListeners () {
        this.eventManager.subscribe(EventManager.EVENTS.CHAT.MESSAGE_ADDED, () => {
            this.fetchAndRender();
        }, this);
    }

    setupStateSubscriptions () {
        this.subscribeToState(StateManager.KEYS.AUTHENTICATED, this.handleAuthState.bind(this));
    }

    handleAuthState (isAuthenticated) {
        if (isAuthenticated) {
            this.showContainer();
            this.fetchAndRender();
            this.schedulePoll();
        } else {
            this.hideContainer();
            this.stopPoll();
            this.resetDisplay();
            this.stateManager.setState(StateManager.KEYS.TOKEN_USAGE, null);
        }
    }

    showContainer () {
        this.container.style.display = '';
        this.container.classList.remove('hidden');
    }

    hideContainer () {
        this.container.style.display = 'none';
    }

    schedulePoll () {
        this.stopPoll();
        this.pollHandle = setTimeout(async () => {
            await this.fetchAndRender();
            this.schedulePoll();
        }, POLL_INTERVAL);
    }

    stopPoll () {
        if (this.pollHandle) {
            clearTimeout(this.pollHandle);
            this.pollHandle = null;
        }
    }

    async fetchAndRender () {
        if (!this.stateManager.getState(StateManager.KEYS.AUTHENTICATED)) {
            return;
        }
        if (this.isFetching) {
            return;
        }

        this.isFetching = true;
        this.setStatus('loading');
        try {
            const result = await this.api.getTokenWatch();
            const tokens = result?.tokens || {};
            const payload = {
                userId: result?.userId,
                tokens: {
                    prompt: Number(tokens.prompt ?? 0),
                    completion: Number(tokens.completion ?? 0),
                    total: Number(tokens.total ?? 0)
                },
                costUsd: Number(result?.costUsd ?? 0),
                lastUpdated: result?.lastUpdated ?? null
            };
            this.stateManager.setState(StateManager.KEYS.TOKEN_USAGE, payload);
            this.renderData(payload);
            this.setStatus('ready');
        } catch (error) {
            console.error('[TokenWatchWidget] Unable to load token usage', error);
            this.setStatus('error');
            this.renderError();
        } finally {
            this.isFetching = false;
        }
    }

    renderData (payload) {
        if (!this.valueElement || !this.costElement) return;
        this.valueElement.textContent = `${this.formatNumber(payload.tokens.total)} tokens`;
        this.costElement.textContent = `$${payload.costUsd.toFixed(4)}`;
    }

    renderError () {
        if (!this.valueElement || !this.costElement) return;
        this.valueElement.textContent = '0 tokens';
        this.costElement.textContent = '$0.0000';
    }

    resetDisplay () {
        if (!this.valueElement || !this.costElement) return;
        this.valueElement.textContent = '-';
        this.costElement.textContent = '$0.0000';
    }

    formatNumber (value) {
        return new Intl.NumberFormat().format(value);
    }

    setStatus (status) {
        this.container.dataset.status = status;
    }
}
