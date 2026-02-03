import { INTENT_TYPES } from '../../langchain/constants.js';
import { createScriptItemIdeaController } from '../item-idea.factory.js';

const themeIdeaController = createScriptItemIdeaController({
  modelName: 'theme',
  itemLabel: 'Theme',
  idParam: 'themeId',
  promptId: 'theme-idea',
  intentType: INTENT_TYPES.THEME_IDEA
});

export default themeIdeaController;
