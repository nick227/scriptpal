import { INTENT_TYPES } from '../constants.js';
import { ScriptAppendChain } from './script/ScriptAppendChain.js';
import { DefaultChain } from './base/DefaultChain.js';
import { ScriptNextLinesChain } from './script/ScriptNextLinesChain.js';
import { ScriptReflectionChain } from './script/ScriptReflectionChain.js';
import { SceneIdeaChain } from './scene/SceneIdeaChain.js';

// Initialize the registry map
const registry = new Map([
  [INTENT_TYPES.SCRIPT_CONVERSATION, ScriptAppendChain],
  [INTENT_TYPES.GENERAL_CONVERSATION, DefaultChain],
  [INTENT_TYPES.NEXT_FIVE_LINES, ScriptNextLinesChain],
  [INTENT_TYPES.SCRIPT_REFLECTION, ScriptReflectionChain],
  [INTENT_TYPES.SCENE_IDEA, SceneIdeaChain]
]);

export const chainRegistry = {
  /**
   * Get a chain class by intent type
   * @param {string} intent
   */
  getChain(intent) {
    return registry.get(intent) || null;
  },

  /**
   * Register a new chain class
   * @param {string} intent
   * @param {Class} chainClass
   */
  registerChain(intent, chainClass) {
    registry.set(intent, chainClass);
  },

  /**
   * List registered intent types
   */
  getRegisteredIntents() {
    return Array.from(registry.keys());
  },

  /**
   * Ensure required chains are present
   */
  isInitialized() {
    const hasScriptConversation = registry.has(INTENT_TYPES.SCRIPT_CONVERSATION);
    const hasGeneralConversation = registry.has(INTENT_TYPES.GENERAL_CONVERSATION);

    const initialized = hasScriptConversation && hasGeneralConversation;
    if (!initialized) {
      console.error('Registry not properly initialized:', {
        hasScriptConversation,
        hasGeneralConversation,
        registeredChains: this.getRegisteredIntents()
      });
    }
    return initialized;
  },

  /**
   * Registry status metadata
   */
  getStatus() {
    const registeredIntents = this.getRegisteredIntents();
    return {
      initialized: this.isInitialized(),
      chainCount: registry.size,
      hasScriptConversation: registry.has(INTENT_TYPES.SCRIPT_CONVERSATION),
      hasGeneralConversation: registry.has(INTENT_TYPES.GENERAL_CONVERSATION),
      registeredChains: registeredIntents
    };
  }
};
