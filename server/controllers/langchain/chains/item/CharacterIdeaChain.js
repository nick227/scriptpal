import { INTENT_TYPES } from '../../constants.js';
import { createTaggedItemIdeaChain } from './TaggedItemIdeaChain.js';

export const CharacterIdeaChain = createTaggedItemIdeaChain({
  intent: INTENT_TYPES.CHARACTER_IDEA,
  itemLabel: 'Character'
});
