import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';
import { initSharedTopBarWidgets } from '../layout/sharedTopBarWidgets.js';
import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { ScriptPalUser } from '../services/api/ScriptPalUser.js';
import { StateManager } from '../core/StateManager.js';
import { EventManager } from '../core/EventManager.js';
import { initPageFrameNavigation, registerPageFrameCleanup } from '../layout/pageFrameNavigation.js';

const getUsernameFromPath = () => {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length < 2 || segments[0] !== 'u') return '';
    return decodeURIComponent(segments[1]).trim().toLowerCase();
};

const formatDate = (value) => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const buildMonogram = (username) => {
    if (!username) return 'WR';
    const pieces = String(username)
        .split('_')
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2);

    const letters = pieces.map((part) => part.charAt(0).toUpperCase()).join('');
    return letters || username.slice(0, 2).toUpperCase();
};

const createScriptCard = (script) => {
    const card = document.createElement('article');
    card.className = 'public-user-script-card';

    const title = script?.title || 'Untitled Script';
    const slug = script?.slug;
    const publicId = script?.publicId;
    const href = publicId
        ? `/public/${encodeURIComponent(publicId)}${slug ? `/${encodeURIComponent(slug)}` : ''}`
        : '#';
    const summary = script?.description || script?.summary || 'No summary available.';
    const updatedAt = formatDate(script?.updatedAt || script?.createdAt);

    const meta = document.createElement('p');
    meta.className = 'public-user-script-card__meta';
    meta.textContent = `Updated ${updatedAt}`;

    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = href;
    link.textContent = title;
    heading.appendChild(link);

    const summaryEl = document.createElement('p');
    summaryEl.className = 'public-user-script-card__summary';
    summaryEl.textContent = summary;

    card.appendChild(meta);
    card.appendChild(heading);
    card.appendChild(summaryEl);

    return card;
};

const setStatusVisibility = ({ loadingEl, errorEl, emptyEl, scriptsEl }, state) => {
    if (loadingEl) loadingEl.style.display = state === 'loading' ? 'block' : 'none';
    if (errorEl) errorEl.style.display = state === 'error' ? 'block' : 'none';
    if (emptyEl) emptyEl.style.display = state === 'empty' ? 'block' : 'none';
    if (scriptsEl) scriptsEl.style.display = state === 'ready' ? 'grid' : 'none';
};

export const mountPublicUserPage = async({ preserveTopBar = false } = {}) => {
    if (!preserveTopBar) {
        renderSharedTopBar();
    }

    const username = getUsernameFromPath();
    const api = new ScriptPalAPI();

    if (!preserveTopBar) {
        const topBarElements = getTopBarElements();
        const user = new ScriptPalUser(api);
        const stateManager = new StateManager();
        const eventManager = new EventManager();

        const isAuthenticated = await user.checkSession();
        stateManager.setState(StateManager.KEYS.USER, isAuthenticated ? user.getCurrentUser() : null);
        stateManager.setState(StateManager.KEYS.AUTHENTICATED, isAuthenticated);

        const { authWidget } = await initSharedTopBarWidgets(
            api,
            user,
            stateManager,
            eventManager,
            topBarElements
        );

        if (authWidget) {
            if (isAuthenticated) {
                authWidget.updateUIForAuthenticatedUser(user.getCurrentUser());
            } else {
                authWidget.updateUIForUnauthenticatedUser();
            }
        }
    }

    const titleEl = document.getElementById('public-user-title');
    const handleEl = document.getElementById('public-user-handle');
    const monogramEl = document.getElementById('public-user-monogram');
    const countEl = document.getElementById('public-user-script-count');
    const pageEl = document.getElementById('public-user-page');

    const loadingEl = document.getElementById('public-user-loading');
    const errorEl = document.getElementById('public-user-error');
    const emptyEl = document.getElementById('public-user-empty');
    const scriptsEl = document.getElementById('public-user-scripts');

    const statusEls = { loadingEl, errorEl, emptyEl, scriptsEl };

    if (!username) {
        setStatusVisibility(statusEls, 'error');
        if (errorEl) {
            errorEl.textContent = 'Invalid username route.';
        }
        return () => {};
    }

    setStatusVisibility(statusEls, 'loading');

    try {
        const payload = await api.publicScripts.getPublicUserProfile(username);
        const user = payload?.user || {};
        const scripts = Array.isArray(payload?.scripts) ? payload.scripts : [];
        const meta = payload?.meta || {};
        const canonicalUsername = user.username || username;

        if (titleEl) {
            titleEl.textContent = `${canonicalUsername}'s Profile`;
        }
        if (handleEl) {
            handleEl.textContent = `@${canonicalUsername}`;
        }
        if (monogramEl) {
            monogramEl.textContent = buildMonogram(canonicalUsername);
        }
        if (countEl) {
            countEl.textContent = String(meta.total || scripts.length || 0);
        }
        if (pageEl) {
            pageEl.textContent = String(meta.page || 1);
        }

        if (scriptsEl) {
            scriptsEl.innerHTML = '';
        }

        if (scripts.length === 0) {
            setStatusVisibility(statusEls, 'empty');
            return () => {};
        }

        scripts.forEach((script) => scriptsEl?.appendChild(createScriptCard(script)));
        setStatusVisibility(statusEls, 'ready');
    } catch (error) {
        console.error('[PublicUserPage] Failed to load profile:', error);
        setStatusVisibility(statusEls, 'error');
        if (errorEl) {
            errorEl.textContent = error?.message || 'Unable to load profile.';
        }
    }
    return () => {};
};

mountPublicUserPage()
    .then((cleanup) => {
        registerPageFrameCleanup(cleanup);
        initPageFrameNavigation();
    })
    .catch((error) => {
        console.error('[PublicUserPage] Initialization failed:', error);
    });
