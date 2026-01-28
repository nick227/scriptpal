import { INTENT_TYPES } from './langchain/constants.js';
import { createScriptItemIdeaController } from './scriptItemIdeaControllerFactory.js';

const themeIdeaController = createScriptItemIdeaController({
  modelName: 'theme',
  itemLabel: 'Theme',
  idParam: 'themeId',
  promptId: 'theme-idea',
  intentType: INTENT_TYPES.THEME_IDEA
});

export default themeIdeaController;
