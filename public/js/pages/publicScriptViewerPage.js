import { ScriptPalAPI } from '../classes/api.js';
import { ScriptPalUser } from '../classes/user.js';
import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { AuthWidget } from '../widgets/auth/AuthWidget.js';
import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';

const getQueryParam = (key) => {
    return new URLSearchParams(window.location.search).get(key);
};

const escapeHtml = (value) => {
    if (typeof value !== 'string') return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const initPublicScriptViewer = async () => {
    renderSharedTopBar();
    const elements = getTopBarElements();
    const api = new ScriptPalAPI();
    const stateManager = new StateManager();
    const eventManager = new EventManager();
    const user = new ScriptPalUser(api);
    const authWidget = new AuthWidget(elements, stateManager, user, eventManager);
    await authWidget.initialize(elements);

    const scriptId = getQueryParam('id');
    const viewer = document.querySelector('.public-script-viewer__content');
    const titleEl = document.querySelector('.public-script-viewer__title');
    const metadataEl = document.querySelector('.public-script-viewer__metadata');
    const ownerEl = document.querySelector('.public-script-owner');
    const copyBtn = document.querySelector('.public-script-copy');

    if (!scriptId) {
        if (viewer) viewer.textContent = 'No script selected.';
        return;
    }

    try {
        const script = await api.getPublicScript(scriptId);
        if (!script) {
            if (viewer) viewer.innerHTML = '<div class="public-script-error">Script is not available.</div>';
            return;
        }

        if (titleEl) {
            titleEl.textContent = script.title || 'Untitled Script';
        }

        if (metadataEl) {
            metadataEl.textContent = `Version ${script.versionNumber || 1} · Updated ${new Date(script.updatedAt).toLocaleString()}`;
        }

        if (ownerEl) {
            ownerEl.textContent = script.owner?.email ? `Owned by ${script.owner.email}` : 'Owner not available';
        }

        if (viewer) {
            viewer.innerHTML = `<pre>${escapeHtml(script.content || '')}</pre>`;
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(script.content || '');
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy content';
                    }, 1500);
                } catch (error) {
                    console.error('Copy failed', error);
                    copyBtn.textContent = 'Copy failed';
                }
            });
        }
    } catch (error) {
        console.error('[PublicScriptViewer] Failed to load script:', error);
        if (viewer) viewer.innerHTML = '<div class="public-script-error">Unable to load script.</div>';
    }
};

initPublicScriptViewer();
