import { INTENT_TYPES } from '../constants.js';
import { chainRegistry } from './registry.js';

import { ScriptAppendChain } from './script/ScriptAppendChain.js';
import { ScriptReflectionChain } from './script/ScriptReflectionChain.js';
import { DefaultChain } from './base/DefaultChain.js';
import { SceneIdeaChain } from './scene/SceneIdeaChain.js';
import { CharacterIdeaChain } from './item/CharacterIdeaChain.js';
import { LocationIdeaChain } from './item/LocationIdeaChain.js';
import { ThemeIdeaChain } from './item/ThemeIdeaChain.js';
import { OutlineIdeaChain } from './outline/OutlineIdeaChain.js';
import { ScriptPageAppendChain } from './script/ScriptPageAppendChain.js';
import { APPEND_SCRIPT_INTENT } from '../../script-services/AppendPageService.js';

// Register the active chains
try {
  console.log('Starting chain registration...');

  chainRegistry.registerChain(INTENT_TYPES.SCRIPT_CONVERSATION, ScriptAppendChain);
  chainRegistry.registerChain(INTENT_TYPES.SCRIPT_REFLECTION, ScriptReflectionChain);
  chainRegistry.registerChain(INTENT_TYPES.GENERAL_CONVERSATION, DefaultChain);
  chainRegistry.registerChain(INTENT_TYPES.SCENE_IDEA, SceneIdeaChain);
  chainRegistry.registerChain(INTENT_TYPES.CHARACTER_IDEA, CharacterIdeaChain);
  chainRegistry.registerChain(INTENT_TYPES.LOCATION_IDEA, LocationIdeaChain);
  chainRegistry.registerChain(INTENT_TYPES.THEME_IDEA, ThemeIdeaChain);
  chainRegistry.registerChain(INTENT_TYPES.OUTLINE_IDEA, OutlineIdeaChain);
  chainRegistry.registerChain(APPEND_SCRIPT_INTENT, ScriptPageAppendChain);

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
