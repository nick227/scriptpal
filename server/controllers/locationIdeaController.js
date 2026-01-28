import { INTENT_TYPES } from './langchain/constants.js';
import { createScriptItemIdeaController } from './scriptItemIdeaControllerFactory.js';

const locationIdeaController = createScriptItemIdeaController({
  modelName: 'location',
  itemLabel: 'Location',
  idParam: 'locationId',
  promptId: 'location-idea',
  intentType: INTENT_TYPES.LOCATION_IDEA
});

export default locationIdeaController;
