import { StateManager } from '../core/StateManager.js';

export class WidgetStateManager extends StateManager {
    constructor(initialState = {}) {
        super();

        // Widget-specific state keys
        this.state = new Map([
            ['ready', false],
            ['active', false],
            ['error', null],
            ['dirty', false],
            ...Object.entries(initialState)
        ]);

        // Widget-specific validators
        this.validators = {
            ...this.validators,
            ready: (value) => typeof value === 'boolean',
            active: (value) => typeof value === 'boolean',
            dirty: (value) => typeof value === 'boolean'
        };
    }

    // Widget-specific state methods
    isReady() {
        return this.getState('ready');
    }

    isActive() {
        return this.getState('active');
    }

    isDirty() {
        return this.getState('dirty');
    }

    markDirty(isDirty = true) {
        this.setState('dirty', isDirty);
    }

    setReady(isReady = true) {
        this.setState('ready', isReady);
    }

    setActive(isActive = true) {
        this.setState('active', isActive);
    }

    // Common widget state keys
    static KEYS = {
        ...StateManager.KEYS,
        READY: 'ready',
        ACTIVE: 'active',
        DIRTY: 'dirty'
    };
}