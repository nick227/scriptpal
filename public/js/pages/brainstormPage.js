import { requireAuth } from '../auth/authGate.js';
import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';
import { initSharedTopBarWidgets } from '../layout/sharedTopBarWidgets.js';
import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { ScriptPalUser } from '../services/api/ScriptPalUser.js';
import { BrainstormBoard } from '../widgets/brainstorm/BrainstormBoard.js';

const initBrainstormPage = async () => {
    const { authenticated } = await requireAuth();
    if (!authenticated) {
        return;
    }

    renderSharedTopBar();

    const elements = getTopBarElements();
    const api = new ScriptPalAPI();
    const stateManager = new StateManager();
    const eventManager = new EventManager();
    const user = new ScriptPalUser(api);
    await initSharedTopBarWidgets(api, user, stateManager, eventManager, elements);

    const board = new BrainstormBoard({ api });
    await board.initialize();
};

initBrainstormPage().catch((error) => {
    console.error('[BrainstormPage] Initialization failed:', error);
});
