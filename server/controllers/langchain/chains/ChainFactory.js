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
        this.registerChain(INTENT_TYPES.ANALYZE_SCRIPT, ScriptAnalyzerChain);
        this.registerChain(INTENT_TYPES.LIST_SCENES, SceneListChain);
        this.registerChain(INTENT_TYPES.LIST_BEATS, BeatListChain);
        this.registerChain(INTENT_TYPES.GET_INSPIRATION, InspirationChain);
        this.registerChain(INTENT_TYPES.SCRIPT_QUESTIONS, ScriptQuestionsChain);

        // Always register the default chain last
        this.registerChain(INTENT_TYPES.EVERYTHING_ELSE, DefaultChain);
    }

    registerChain(intentType, ChainClass) {
        if (!(ChainClass.prototype instanceof BaseChain)) {
            throw new Error('Chain must extend BaseChain');
        }
        this.chains.set(intentType, ChainClass);
    }

    createChain(intentType, config = {}) {
        console.log('\n=========================================');
        console.log('\n=========================================');
        console.log('Requested intent:', intentType);

        const ChainClass = this.chains.get(intentType);
        if (!ChainClass) {
            console.log('No specific chain found, falling back to default chain');
            const defaultChain = this.chains.get(INTENT_TYPES.EVERYTHING_ELSE);
            if (!defaultChain) {
                console.error('Default chain not registered!');
                throw new Error(ERROR_TYPES.INVALID_INTENT);
            }
            return new defaultChain(config);
        }
        return new ChainClass(config);
    }

    async executeChain(intentType, input, context = {}, config = {}) {
        const chain = this.createChain(intentType, config);
        return chain.run(input, context);
    }

    getRegisteredIntents() {
        return Array.from(this.chains.keys());
    }
}

// Export singleton instance
export const chainFactory = new ChainFactory();