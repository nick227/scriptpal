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
                list: (scriptId) => api.getThemes(scriptId),
                create: (scriptId, payload) => api.createTheme(scriptId, payload),
                update: (scriptId, themeId, payload) => api.updateTheme(scriptId, themeId, payload),
                delete: (scriptId, themeId) => api.deleteTheme(scriptId, themeId),
                reorder: (scriptId, order) => api.reorderThemes(scriptId, order),
                generateIdea: (scriptId, themeId, payload) => api.generateThemeIdea(scriptId, themeId, payload),
                generateIdeaDraft: (scriptId, payload) => api.generateThemeIdeaDraft(scriptId, payload)
            }
        });
    }
}
