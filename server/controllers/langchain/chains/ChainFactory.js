import { INTENT_TYPES, ERROR_TYPES } from '../constants.js';
import { BaseChain } from './base/BaseChain.js';

// Import all chains
import { ScriptAnalyzerChain } from './analysis/scriptAnalyzer.js';
import { SceneListChain } from './creative/sceneLister.js';
import { BeatListChain } from './creative/beatLister.js';
import { InspirationChain } from './creative/inspirationGen.js';
import { ScriptQuestionsChain } from './creative/scriptQuestions.js';
import { DefaultChain } from './base/DefaultChain.js';

class ChainFactory {
    constructor() {
        this.chains = new Map();
        this.registerDefaultChains();
    }

    registerDefaultChains() {
        // Register core chains
        this.registerChain(INTENT_TYPES.SCRIPT_QUESTIONS, new ScriptQuestionsChain());
        this.registerChain(INTENT_TYPES.GET_INSPIRATION, new InspirationChain());
        this.registerChain(INTENT_TYPES.ANALYZE_SCRIPT, new ScriptAnalyzerChain());

        // Always register the default chain last
        this.registerChain(INTENT_TYPES.EVERYTHING_ELSE, new DefaultChain());
    }

    registerChain(intentType, chain) {
        this.chains.set(intentType, chain);
    }

    getChain(intentType) {
        return this.chains.get(intentType);
    }

    getRegisteredIntents() {
        return Array.from(this.chains.keys());
    }

    /**
     * Execute a chain with context
     * @param {BaseChain} chain - Chain instance to execute
     * @param {Object} context - Context object containing script info and content
     * @param {string} prompt - User prompt
     * @returns {Promise<Object>} Chain response
     */
    async executeChain(chain, context, prompt) {
        if (!chain || typeof chain.run !== 'function') {
            throw new Error('Invalid chain provided');
        }

        return await chain.run(context, prompt);
    }
}

// Export singleton instance
export const chainFactory = new ChainFactory();