import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { bindAuthenticatedStateGuard, requireAuth } from '../auth/authGate.js';
import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';
import { initSharedTopBarWidgets } from '../layout/sharedTopBarWidgets.js';
import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { PublicScriptsWidget } from '../widgets/script/PublicScriptsWidget.js';
import { initPageFrameNavigation, registerPageFrameCleanup } from '../layout/pageFrameNavigation.js';

export const mountPublicScriptsPage = async ({ preserveTopBar = false } = {}) => {
    const auth = await requireAuth();
    if (!auth.authenticated) {
        return () => {};
    }

    if (!preserveTopBar) {
        renderSharedTopBar();
    }

    const api = auth.user?.api || new ScriptPalAPI();
    const stateManager = new StateManager();
    const eventManager = new EventManager();
    const user = auth.user;

    bindAuthenticatedStateGuard(stateManager, user);

    if (!preserveTopBar) {
        const elements = getTopBarElements();
        await initSharedTopBarWidgets(api, user, stateManager, eventManager, elements);
    }

    const widget = new PublicScriptsWidget({ api });
    await widget.initialize();

    return () => {};
};

mountPublicScriptsPage()
    .then((cleanup) => {
        registerPageFrameCleanup(cleanup);
        initPageFrameNavigation();
    })
    .catch((error) => {
        console.error('[PublicScriptsPage] Initialization failed:', error);
        const list = document.querySelector('.public-scripts-list');
        if (list) {
            list.innerHTML = '<div class="public-script-error">Unable to initialize page.</div>';
        }
    });
