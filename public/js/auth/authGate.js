import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { ScriptPalUser } from '../services/api/ScriptPalUser.js';
import { StateManager } from '../core/StateManager.js';

const buildRedirectUrl = (redirectTo, returnTo) => {
    const encoded = encodeURIComponent(returnTo);
    return `${redirectTo}?redirect=${encoded}`;
};

export const getCurrentReturnTo = () => {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

export const redirectToAuthPage = ({ redirectTo = '/auth.html' } = {}) => {
    window.location.replace(buildRedirectUrl(redirectTo, getCurrentReturnTo()));
};

export const bindAuthenticatedStateGuard = (
    stateManager,
    user,
    { redirectTo = '/auth.html' } = {}
) => {
    if (!stateManager || !user) {
        throw new Error('StateManager and user are required for auth state guard');
    }

    stateManager.setState(StateManager.KEYS.USER, user.getCurrentUser());
    stateManager.setState(StateManager.KEYS.AUTHENTICATED, true);
    stateManager.subscribe(StateManager.KEYS.AUTHENTICATED, (authenticated) => {
        if (!authenticated) {
            redirectToAuthPage({ redirectTo });
        }
    });
};

export const requireAuth = async ({ redirectTo = '/auth.html' } = {}) => {
    const api = new ScriptPalAPI();
    const user = new ScriptPalUser(api);

    const isAuthenticated = await user.checkSession();
    if (!isAuthenticated) {
        redirectToAuthPage({ redirectTo });
        return { authenticated: false };
    }

    return { authenticated: true, user };
};
