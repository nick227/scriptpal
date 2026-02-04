import { StateManager } from '../core/StateManager.js';
import { ScriptItemStore } from './ScriptItemStore.js';
import { ITEM_LABELS } from '../shared/itemLabels.js';

export class LocationStore extends ScriptItemStore {
    constructor (api, stateManager, eventManager) {
        super(api, stateManager, eventManager, {
            stateKey: StateManager.KEYS.LOCATIONS,
            currentIdKey: StateManager.KEYS.CURRENT_LOCATION_ID,
            itemLabel: ITEM_LABELS.LOCATION,
            orderKey: 'locationId',
            apiHandlers: {
                list: (scriptId) => api.entities.getLocations(scriptId),
                create: (scriptId, payload) => api.entities.createLocation(scriptId, payload),
                update: (scriptId, locationId, payload) => api.entities.updateLocation(scriptId, locationId, payload),
                delete: (scriptId, locationId) => api.entities.deleteLocation(scriptId, locationId),
                reorder: (scriptId, order) => api.entities.reorderLocations(scriptId, order),
                generateIdea: (scriptId, locationId, payload) => api.entities.generateLocationIdea(scriptId, locationId, payload),
                generateIdeaDraft: (scriptId, payload) => api.entities.generateLocationIdeaDraft(scriptId, payload)
            }
        });
    }
}
