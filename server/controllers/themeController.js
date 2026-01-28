import { createScriptItemController } from './scriptItemControllerFactory.js';

const themeController = createScriptItemController({
  modelName: 'theme',
  itemLabel: 'Theme',
  idParam: 'themeId',
  orderKey: 'themeId'
});

export default themeController;
