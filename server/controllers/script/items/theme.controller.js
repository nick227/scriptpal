import { createScriptItemController } from '../item.factory.js';

const themeController = createScriptItemController({
  modelName: 'theme',
  itemLabel: 'Theme',
  idParam: 'themeId',
  orderKey: 'themeId'
});

export default themeController;
