import { createScriptItemController } from './scriptItemControllerFactory.js';

const locationController = createScriptItemController({
  modelName: 'location',
  itemLabel: 'Location',
  idParam: 'locationId',
  orderKey: 'locationId'
});

export default locationController;
