import { INTENT_TYPES } from '../../constants.js';
import { createTaggedItemIdeaChain } from './TaggedItemIdeaChain.js';

export const ThemeIdeaChain = createTaggedItemIdeaChain({
  intent: INTENT_TYPES.THEME_IDEA,
  itemLabel: 'Theme'
});
