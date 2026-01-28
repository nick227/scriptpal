import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { ScriptPalUser } from '../services/api/ScriptPalUser.js';
import { AuthWidget } from '../widgets/auth/AuthWidget.js';

const getRedirectTarget = () => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
        return redirect;
    }
    return '/';
};

const initAuthPage = async () => {
    const api = new ScriptPalAPI();
    const user = new ScriptPalUser(api);
    const stateManager = new StateManager();
    const eventManager = new EventManager();

    const redirectTarget = getRedirectTarget();
    const isAuthenticated = await user.checkSession();
    if (isAuthenticated) {
        window.location.replace(redirectTarget);
        return;
    }

    const elements = {
        formsContainer: document.querySelector('.auth-forms'),
        logoutButton: document.querySelector('.logout-button'),
        userInfo: document.querySelector('.auth-user'),
        messagesContainer: null
    };

    const authWidget = new AuthWidget(elements, stateManager, user, eventManager);
    await authWidget.initialize(elements);

    stateManager.subscribe(StateManager.KEYS.AUTHENTICATED, (authenticated) => {
        if (authenticated) {
            window.location.replace(redirectTarget);
        }
    });
};

initAuthPage().catch((error) => {
    console.error('[AuthPage] Initialization failed:', error);
});
