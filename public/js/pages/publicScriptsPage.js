import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';
import { initSharedTopBarWidgets } from '../layout/sharedTopBarWidgets.js';
import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { ScriptPalUser } from '../services/api/ScriptPalUser.js';
import { PublicScriptsWidget } from '../widgets/script/PublicScriptsWidget.js';

const initPublicScriptsPage = async () => {
    renderSharedTopBar();

    const elements = getTopBarElements();
    const api = new ScriptPalAPI();
    const stateManager = new StateManager();
    const eventManager = new EventManager();
    const user = new ScriptPalUser(api);
    await initSharedTopBarWidgets(api, user, stateManager, eventManager, elements);

    const widget = new PublicScriptsWidget({ api });
    await widget.initialize();
};

initPublicScriptsPage().catch((error) => {
    console.error('[PublicScriptsPage] Initialization failed:', error);
    const list = document.querySelector('.public-scripts-list');
    if (list) {
        list.innerHTML = '<div class="public-script-error">Unable to initialize page.</div>';
    }
});
