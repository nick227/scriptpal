import { INTENT_TYPES } from '../constants.js';
import { chainRegistry } from './registry.js';

// Import all chains
import { ScriptAnalyzerChain } from './analysis/scriptAnalyzer.js';
import { SceneListChain as _SceneListChain } from './creative/sceneLister.js';
import { BeatListChain as _BeatListChain } from './creative/beatLister.js';
import { InspirationChain } from './creative/inspirationGen.js';
import { ScriptQuestionsChain } from './creative/scriptQuestions.js';
import { DefaultChain } from './base/DefaultChain.js';
import { WriteScriptChain } from './edit/WriteScript.js';
import { EditScriptChain } from './edit/EditScript.js';
import { SaveElementChain } from './save/SaveElementChain.js';

// Register all chains with their configurations
try {
  console.log('Starting chain registration...');

  // Core writing chain
  chainRegistry.registerChain(INTENT_TYPES.WRITE_SCRIPT, WriteScriptChain);

  // Edit Script Chain
  chainRegistry.registerChain(INTENT_TYPES.EDIT_SCRIPT, EditScriptChain);

  // Save Element Chain
  chainRegistry.registerChain(INTENT_TYPES.SAVE_ELEMENT, SaveElementChain);

  // Analysis chains
  chainRegistry.registerChain(INTENT_TYPES.SCRIPT_QUESTIONS, ScriptQuestionsChain);
  chainRegistry.registerChain(INTENT_TYPES.ANALYZE_SCRIPT, ScriptAnalyzerChain);

  // Creative chains
  chainRegistry.registerChain(INTENT_TYPES.GET_INSPIRATION, InspirationChain);

  // Default chain for unhandled intents - Must be registered last
  chainRegistry.registerChain(INTENT_TYPES.EVERYTHING_ELSE, DefaultChain);

  // Verify initialization
  if (!chainRegistry.isInitialized()) {
    throw new Error('Chain registry failed to initialize properly');
  }

  console.log('Chain registration completed successfully');
  console.log('Registry status:', chainRegistry.getStatus());

} catch (error) {
  console.error('Failed to register chains:', error);
  throw new Error(`Chain registration failed: ${error.message}`);
}

// Export the registry instance
export { chainRegistry };
