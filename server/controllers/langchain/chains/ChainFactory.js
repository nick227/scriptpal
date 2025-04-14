import { INTENT_TYPES } from '../constants.js';
import { chainRegistry } from './registry.js';

// Import all chains
import { ScriptAnalyzerChain } from './analysis/scriptAnalyzer.js';
import { SceneListChain } from './creative/sceneLister.js';
import { BeatListChain } from './creative/beatLister.js';
import { InspirationChain } from './creative/inspirationGen.js';
import { ScriptQuestionsChain } from './creative/scriptQuestions.js';
import { DefaultChain } from './base/DefaultChain.js';
import { WriteScriptChain } from './creative/WriteScript.js';

// Register all chains with their configurations
try {
    console.log('Starting chain registration...');

    // Core writing chain
    chainRegistry.register(INTENT_TYPES.WRITE_SCRIPT, WriteScriptChain, {
        requiresAuth: true,
        shouldGenerateQuestions: false, // Custom buttons handled in chain
        modelConfig: {
            temperature: 0.7,
            response_format: { type: "text" }
        },
        condition: (context) => !!context.scriptId // Only run if we have a scriptId
    });

    // Analysis chains
    chainRegistry.register(INTENT_TYPES.SCRIPT_QUESTIONS, ScriptQuestionsChain, {
        requiresAuth: true,
        modelConfig: { temperature: 0.3 }
    });

    chainRegistry.register(INTENT_TYPES.ANALYZE_SCRIPT, ScriptAnalyzerChain, {
        requiresAuth: true,
        shouldGenerateQuestions: false,
        modelConfig: {
            temperature: 0.2,
            response_format: { type: "text" }
        }
    });

    // Creative chains
    chainRegistry.register(INTENT_TYPES.GET_INSPIRATION, InspirationChain, {
        modelConfig: { temperature: 0.8 }
    });

    // Default chain for unhandled intents - Must be registered last
    chainRegistry.register(INTENT_TYPES.EVERYTHING_ELSE, DefaultChain, {
        shouldGenerateQuestions: true, // Enable questions for better UX
        modelConfig: { temperature: 0.5 }
    });

    // Complete registration and validate
    chainRegistry.completeRegistration();

    console.log('Chain registration completed successfully');
    console.log('Registry status:', chainRegistry.getStatus());

} catch (error) {
    console.error('Failed to register chains:', error);
    throw new Error(`Chain registration failed: ${error.message}`);
}

// Export the registry instance
export { chainRegistry };