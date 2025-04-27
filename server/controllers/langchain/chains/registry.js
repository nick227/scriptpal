import { INTENT_TYPES } from '../constants.js';
import { EditScriptChain } from './edit/EditScript.js';
import { SaveElementChain } from './save/SaveElementChain.js';
import { WriteScriptChain } from './edit/WriteScript.js';

// Initialize the registry
const registry = new Map();

// Register core chains
registry.set(INTENT_TYPES.EDIT_SCRIPT, EditScriptChain);
registry.set(INTENT_TYPES.SAVE_ELEMENT, SaveElementChain);
registry.set(INTENT_TYPES.WRITE_SCRIPT, WriteScriptChain);

export const chainRegistry = {
    /**
     * Get a chain class by intent type
     * @param {string} intent - The intent type
     * @returns {Class|null} The chain class or null if not found
     */
    getChain(intent) {
        return registry.get(intent) || null;
    },

    /**
     * Register a new chain class
     * @param {string} intent - The intent type
     * @param {Class} chainClass - The chain class to register
     */
    registerChain(intent, chainClass) {
        registry.set(intent, chainClass);
    },

    /**
     * Get all registered intent types
     * @returns {Array<string>} Array of registered intent types
     */
    getRegisteredIntents() {
        return Array.from(registry.keys());
    },

    /**
     * Check if registry is properly initialized with required chains
     * @returns {boolean} True if registry is properly initialized
     */
    isInitialized() {
        // Check if we have the minimum required chains
        const hasDefaultChain = registry.has(INTENT_TYPES.EVERYTHING_ELSE);
        const hasEditChain = registry.has(INTENT_TYPES.EDIT_SCRIPT);
        const hasSaveChain = registry.has(INTENT_TYPES.SAVE_ELEMENT);

        const initialized = hasDefaultChain && hasEditChain && hasSaveChain;
        if (!initialized) {
            console.error('Registry not properly initialized:', {
                hasDefaultChain,
                hasEditChain,
                hasSaveChain,
                registeredChains: this.getRegisteredIntents()
            });
        }
        return initialized;
    },

    /**
     * Get detailed registry status
     * @returns {Object} Registry status information
     */
    getStatus() {
        const registeredIntents = this.getRegisteredIntents();
        return {
            initialized: this.isInitialized(),
            chainCount: registry.size,
            hasDefaultChain: registry.has(INTENT_TYPES.EVERYTHING_ELSE),
            registeredChains: registeredIntents
        };
    }
};