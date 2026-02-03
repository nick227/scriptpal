import { INTENT_TYPES } from '../../langchain/constants.js';
import { createScriptItemIdeaController } from '../item-idea.factory.js';

const characterIdeaController = createScriptItemIdeaController({
  modelName: 'character',
  itemLabel: 'Character',
  idParam: 'characterId',
  promptId: 'character-idea',
  intentType: INTENT_TYPES.CHARACTER_IDEA
});

export default characterIdeaController;
