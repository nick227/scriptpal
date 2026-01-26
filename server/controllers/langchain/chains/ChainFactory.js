import { INTENT_TYPES } from '../constants.js';
import { chainRegistry } from './registry.js';

import { ScriptAppendChain } from './script/ScriptAppendChain.js';
import { ScriptReflectionChain } from './script/ScriptReflectionChain.js';
import { DefaultChain } from './base/DefaultChain.js';

// Register the active chains
try {
  console.log('Starting chain registration...');

  chainRegistry.registerChain(INTENT_TYPES.SCRIPT_CONVERSATION, ScriptAppendChain);
  chainRegistry.registerChain(INTENT_TYPES.SCRIPT_REFLECTION, ScriptReflectionChain);
  chainRegistry.registerChain(INTENT_TYPES.GENERAL_CONVERSATION, DefaultChain);

  if (!chainRegistry.isInitialized()) {
    throw new Error('Chain registry failed to initialize properly');
  }

  console.log('Chain registration completed successfully');
  console.log('Registry status:', chainRegistry.getStatus());
} catch (error) {
  console.error('Failed to register chains:', error);
  throw new Error(`Chain registration failed: ${error.message}`);
}

export { chainRegistry };
