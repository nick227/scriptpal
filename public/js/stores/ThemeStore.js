import { StateManager } from '../core/StateManager.js';
import { ScriptItemStore } from './ScriptItemStore.js';
import { ITEM_LABELS } from '../shared/itemLabels.js';

export class ThemeStore extends ScriptItemStore {
    constructor (api, stateManager, eventManager) {
        super(api, stateManager, eventManager, {
            stateKey: StateManager.KEYS.THEMES,
            currentIdKey: StateManager.KEYS.CURRENT_THEME_ID,
            itemLabel: ITEM_LABELS.THEME,
            orderKey: 'themeId',
            apiHandlers: {
                list: (scriptId) => api.entities.getThemes(scriptId),
                create: (scriptId, payload) => api.entities.createTheme(scriptId, payload),
                update: (scriptId, themeId, payload) => api.entities.updateTheme(scriptId, themeId, payload),
                delete: (scriptId, themeId) => api.entities.deleteTheme(scriptId, themeId),
                reorder: (scriptId, order) => api.entities.reorderThemes(scriptId, order),
                generateIdea: (scriptId, themeId, payload) => api.entities.generateThemeIdea(scriptId, themeId, payload),
                generateIdeaDraft: (scriptId, payload) => api.entities.generateThemeIdeaDraft(scriptId, payload)
            }
        });
    }
}
