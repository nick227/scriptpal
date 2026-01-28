import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { ScriptPalUser } from '../services/api/ScriptPalUser.js';

const buildRedirectUrl = (redirectTo, returnTo) => {
    const encoded = encodeURIComponent(returnTo);
    return `${redirectTo}?redirect=${encoded}`;
};

export const requireAuth = async ({ redirectTo = '/auth.html' } = {}) => {
    const api = new ScriptPalAPI();
    const user = new ScriptPalUser(api);

    const isAuthenticated = await user.checkSession();
    if (!isAuthenticated) {
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.replace(buildRedirectUrl(redirectTo, returnTo));
        return { authenticated: false };
    }

    return { authenticated: true, user };
};
