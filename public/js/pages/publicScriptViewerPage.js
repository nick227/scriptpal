import { ScriptPalAPI } from '../classes/api.js';
import { ScriptPalUser } from '../classes/user.js';
import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { AuthWidget } from '../widgets/auth/AuthWidget.js';
import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';
import { LineFormatter } from '../widgets/editor/LineFormatter.js';
import { ScriptDocument } from '../widgets/editor/model/ScriptDocument.js';
import { MAX_LINES_PER_PAGE } from '../widgets/editor/constants.js';

const getQueryParam = (key) => {
    return new URLSearchParams(window.location.search).get(key);
};

const setViewerMessage = (container, message, isError = false) => {
    if (!container) return;
    const className = isError ? 'public-script-error' : 'public-scripts-loading';
    container.innerHTML = `<div class="${className}">${message}</div>`;
};

const renderStaticScriptLines = (container, content) => {
    if (!container) return;
    container.innerHTML = '';
    const documentModel = ScriptDocument.fromStorage(content || '');
    if (!documentModel.lines || documentModel.lines.length === 0) {
        setViewerMessage(container, 'Script content is unavailable.', true);
        return;
    }

    const chunkSize = MAX_LINES_PER_PAGE || 22;
    const totalLines = documentModel.lines.length;
    for (let i = 0; i < totalLines; i += chunkSize) {
        const chunk = documentModel.lines.slice(i, i + chunkSize);
        const page = document.createElement('div');
        page.className = 'editor-page public-script-viewer__page';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'editor-page-content';

        chunk.forEach((line) => {
            const lineElement = LineFormatter.createStaticLine({
                format: line.format,
                content: line.content
            });
            contentWrapper.appendChild(lineElement);
        });

        page.appendChild(contentWrapper);
        container.appendChild(page);

        const isLastPage = i + chunkSize >= totalLines;
        if (!isLastPage) {
            const indicator = document.createElement('div');
            indicator.className = 'page-break-indicator';
            container.appendChild(indicator);
        }
    }
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
    const viewerLines = document.querySelector('.public-script-viewer__lines');
    const titleEl = document.querySelector('.public-script-viewer__title');
    const metadataEl = document.querySelector('.public-script-viewer__metadata');
    const ownerEl = document.querySelector('.public-script-owner');

    if (!scriptId) {
        setViewerMessage(viewerLines, 'No script selected.', false);
        return;
    }

    try {
        const script = await api.getPublicScript(scriptId);
        if (!script) {
            setViewerMessage(viewerLines, 'Script is not available.', true);
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

        renderStaticScriptLines(viewerLines, script.content || '');
    } catch (error) {
        console.error('[PublicScriptViewer] Failed to load script:', error);
        setViewerMessage(viewerLines, 'Unable to load script.', true);
    }
};

initPublicScriptViewer();
