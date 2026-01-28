import { INTENT_TYPES } from './langchain/constants.js';
import { createScriptItemIdeaController } from './scriptItemIdeaControllerFactory.js';

const characterIdeaController = createScriptItemIdeaController({
  modelName: 'character',
  itemLabel: 'Character',
  idParam: 'characterId',
  promptId: 'character-idea',
  intentType: INTENT_TYPES.CHARACTER_IDEA
});

export default characterIdeaController;
