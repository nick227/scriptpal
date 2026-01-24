import { ScriptPalAPI } from '../classes/api.js';
import { ScriptPalUser } from '../classes/user.js';
import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { AuthWidget } from '../widgets/auth/AuthWidget.js';
import { PublicScriptsWidget } from '../widgets/public/PublicScriptsWidget.js';
import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';

const initPublicScriptsPage = async () => {
    renderSharedTopBar();

    const elements = getTopBarElements();
    const api = new ScriptPalAPI();
    const stateManager = new StateManager();
    const eventManager = new EventManager();
    const user = new ScriptPalUser(api);
    const authWidget = new AuthWidget(elements, stateManager, user, eventManager);

    await authWidget.initialize(elements);

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
