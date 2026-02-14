import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { bindAuthenticatedStateGuard, requireAuth } from '../auth/authGate.js';
import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';
import { initSharedTopBarWidgets, initTokenWatchWidget } from '../layout/sharedTopBarWidgets.js';
import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { initPageFrameNavigation, registerPageFrameCleanup } from '../layout/pageFrameNavigation.js';

const setFeedback = (element, message, type = 'info') => {
    if (!element) return;
    element.textContent = message || '';
    element.dataset.state = message ? type : '';
};

const redirectToAuth = () => {
    const redirect = encodeURIComponent('/profile');
    window.location.replace(`/auth.html?redirect=${redirect}`);
};

const updatePublicProfileUrl = (linkElement, username) => {
    if (!linkElement) return;
    const normalized = typeof username === 'string' ? username.trim().toLowerCase() : '';
    if (!normalized) {
        linkElement.textContent = '';
        linkElement.removeAttribute('href');
        return;
    }
    const path = `/u/${encodeURIComponent(normalized)}`;
    linkElement.textContent = `${window.location.origin}${path}`;
    linkElement.setAttribute('href', path);
};

export const mountProfilePage = async({ preserveTopBar = false } = {}) => {
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
    const profileTokenWatchContainer = document.getElementById('profile-token-watch');
    const profileTokenWatchWidget = await initTokenWatchWidget(
        profileTokenWatchContainer,
        api,
        stateManager,
        eventManager
    );

    const currentUser = user.getCurrentUser();

    const emailInput = document.getElementById('profile-email');
    const usernameInput = document.getElementById('profile-username');
    const publicUrlLink = document.getElementById('profile-public-url');

    const usernameForm = document.getElementById('profile-username-form');
    const passwordForm = document.getElementById('profile-password-form');
    const deleteForm = document.getElementById('profile-delete-form');

    const usernameFeedback = document.getElementById('profile-username-feedback');
    const passwordFeedback = document.getElementById('profile-password-feedback');
    const deleteFeedback = document.getElementById('profile-delete-feedback');

    if (emailInput) {
        emailInput.innerHTML = currentUser?.email || '';
    }
    if (usernameInput) {
        usernameInput.value = currentUser?.username || '';
    }
    updatePublicProfileUrl(publicUrlLink, currentUser?.username);
    usernameInput?.addEventListener('input', () => {
        updatePublicProfileUrl(publicUrlLink, usernameInput.value);
    });

    usernameForm?.addEventListener('submit', async(event) => {
        event.preventDefault();
        setFeedback(usernameFeedback, '');

        const username = usernameInput?.value?.trim()?.toLowerCase() || '';
        if (!username) {
            setFeedback(usernameFeedback, 'Username is required.', 'error');
            return;
        }

        try {
            const updated = await user.updateProfile({ username });
            stateManager.setState(StateManager.KEYS.USER, updated);
            if (usernameInput) {
                usernameInput.value = updated?.username || username;
            }
            updatePublicProfileUrl(publicUrlLink, updated?.username || username);
            setFeedback(usernameFeedback, 'Username updated.', 'success');
        } catch (error) {
            setFeedback(usernameFeedback, error?.message || 'Failed to update username.', 'error');
        }
    });

    passwordForm?.addEventListener('submit', async(event) => {
        event.preventDefault();
        setFeedback(passwordFeedback, '');

        const currentPassword = document.getElementById('profile-current-password')?.value || '';
        const newPassword = document.getElementById('profile-new-password')?.value || '';

        if (!currentPassword || !newPassword) {
            setFeedback(passwordFeedback, 'Both password fields are required.', 'error');
            return;
        }

        try {
            await user.changePassword({ currentPassword, newPassword });
            setFeedback(passwordFeedback, 'Password updated. Please sign in again.', 'success');
            localStorage.removeItem('currentUser');
            setTimeout(() => {
                redirectToAuth();
            }, 500);
        } catch (error) {
            setFeedback(passwordFeedback, error?.message || 'Failed to update password.', 'error');
        }
    });

    deleteForm?.addEventListener('submit', async(event) => {
        event.preventDefault();
        setFeedback(deleteFeedback, '');

        const password = document.getElementById('profile-delete-password')?.value || '';
        const confirm = document.getElementById('profile-delete-confirm')?.value || '';

        if (!password) {
            setFeedback(deleteFeedback, 'Password is required.', 'error');
            return;
        }

        if (confirm !== 'DELETE') {
            setFeedback(deleteFeedback, 'Type DELETE to confirm account deletion.', 'error');
            return;
        }

        try {
            await user.softDeleteCurrentUser({ password, confirm: 'DELETE' });
            setFeedback(deleteFeedback, 'Account deleted.', 'success');
            setTimeout(() => {
                redirectToAuth();
            }, 300);
        } catch (error) {
            setFeedback(deleteFeedback, error?.message || 'Failed to delete account.', 'error');
        }
    });
    return () => {
        if (profileTokenWatchWidget) {
            profileTokenWatchWidget.destroy();
        }
    };
};

mountProfilePage()
    .then((cleanup) => {
        registerPageFrameCleanup(cleanup);
        initPageFrameNavigation();
    })
    .catch((error) => {
        console.error('[ProfilePage] Initialization failed:', error);
    });
