import { createScriptItemController } from '../item.factory.js';

const locationController = createScriptItemController({
  modelName: 'location',
  itemLabel: 'Location',
  idParam: 'locationId',
  orderKey: 'locationId'
});

export default locationController;
