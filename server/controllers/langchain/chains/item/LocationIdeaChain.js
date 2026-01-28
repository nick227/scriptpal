import { INTENT_TYPES } from '../../constants.js';
import { createTaggedItemIdeaChain } from './TaggedItemIdeaChain.js';

export const LocationIdeaChain = createTaggedItemIdeaChain({
  intent: INTENT_TYPES.LOCATION_IDEA,
  itemLabel: 'Location Item'
});
