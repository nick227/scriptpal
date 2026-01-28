import { StateManager } from '../core/StateManager.js';
import { ScriptItemStore } from './ScriptItemStore.js';
import { ITEM_LABELS } from '../shared/itemLabels.js';

export class CharacterStore extends ScriptItemStore {
    constructor (api, stateManager, eventManager) {
        super(api, stateManager, eventManager, {
            stateKey: StateManager.KEYS.CHARACTERS,
            currentIdKey: StateManager.KEYS.CURRENT_CHARACTER_ID,
            itemLabel: ITEM_LABELS.CHARACTER,
            orderKey: 'characterId',
            apiHandlers: {
                list: (scriptId) => api.getCharacters(scriptId),
                create: (scriptId, payload) => api.createCharacter(scriptId, payload),
                update: (scriptId, characterId, payload) => api.updateCharacter(scriptId, characterId, payload),
                delete: (scriptId, characterId) => api.deleteCharacter(scriptId, characterId),
                reorder: (scriptId, order) => api.reorderCharacters(scriptId, order),
                generateIdea: (scriptId, characterId, payload) => api.generateCharacterIdea(scriptId, characterId, payload),
                generateIdeaDraft: (scriptId, payload) => api.generateCharacterIdeaDraft(scriptId, payload)
            }
        });
    }
}
