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
                list: (scriptId) => api.getLocations(scriptId),
                create: (scriptId, payload) => api.createLocation(scriptId, payload),
                update: (scriptId, locationId, payload) => api.updateLocation(scriptId, locationId, payload),
                delete: (scriptId, locationId) => api.deleteLocation(scriptId, locationId),
                reorder: (scriptId, order) => api.reorderLocations(scriptId, order),
                generateIdea: (scriptId, locationId, payload) => api.generateLocationIdea(scriptId, locationId, payload),
                generateIdeaDraft: (scriptId, payload) => api.generateLocationIdeaDraft(scriptId, payload)
            }
        });
    }
}
