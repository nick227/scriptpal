import { createScriptItemController } from '../item.factory.js';

const characterController = createScriptItemController({
  modelName: 'character',
  itemLabel: 'Character',
  idParam: 'characterId',
  orderKey: 'characterId'
});

export default characterController;
