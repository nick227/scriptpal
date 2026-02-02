import { ScriptPalAPI } from '../services/api/ScriptPalAPI.js';
import { ScriptPalUser } from '../services/api/ScriptPalUser.js';
import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { renderSharedTopBar, getTopBarElements } from '../layout/sharedLayout.js';
import { initSharedTopBarWidgets } from '../layout/sharedTopBarWidgets.js';
import { LineFormatter } from '../widgets/editor/LineFormatter.js';
import { ScriptDocument } from '../widgets/editor/model/ScriptDocument.js';
import { MAX_LINES_PER_PAGE } from '../widgets/editor/constants.js';

const getQueryParam = (key) => {
    return new URLSearchParams(window.location.search).get(key);
};

const getSlugFromPath = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const publicIndex = parts.indexOf('public');
    if (publicIndex === -1) {
        return null;
    }
    const slug = parts[publicIndex + 1];
    return slug ? decodeURIComponent(slug) : null;
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

const COMMENT_PAGE_SIZE = 20;

const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const target = new Date(timestamp).getTime();
    if (Number.isNaN(target)) return '';
    const diffSeconds = Math.round((Date.now() - target) / 1000);
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
};

const setupCommentsPanel = (api, authWidget, stateManager) => {
    const toggleButton = document.querySelector('.public-script-comments-toggle');
    const countEl = document.querySelector('.public-script-comments-count');
    const panel = document.getElementById('public-script-comments-panel');
    const loader = panel?.querySelector('.public-script-comments-panel__loader');
    const listEl = panel?.querySelector('.public-script-comments-panel__list');
    const emptyState = panel?.querySelector('.public-script-comments-panel__empty');
    const errorState = panel?.querySelector('.public-script-comments-panel__error');
    const loginNotice = panel?.querySelector('.public-script-comments-panel__login-notice');
    const loginTrigger = panel?.querySelector('[data-comments-login]');
    const composerForm = panel?.querySelector('[data-comments-form]');
    const textarea = panel?.querySelector('#public-script-comment-input');
    const submitButton = panel?.querySelector('.public-script-comments-panel__composer-actions button');
    const backdrop = document.querySelector('[data-comments-backdrop]');
    const closeButton = panel?.querySelector('.public-script-comments-panel__close');

    if (!panel || !toggleButton) {
        return null;
    }

    let currentScriptId = null;
    let isPanelOpen = false;
    let hasLoadedComments = false;
    let comments = [];
    let commentCount = 0;
    let isLoading = false;
    let isPosting = false;
    let isAuthenticated = Boolean(stateManager.getState(StateManager.KEYS.AUTHENTICATED));

    const updateToggleState = (enabled) => {
        toggleButton.disabled = !enabled;
        if (!enabled) {
            toggleButton.setAttribute('aria-expanded', 'false');
        }
    };

    const updateCommentCount = (value) => {
        const normalized = Number.isFinite(Number(value)) ? Number(value) : 0;
        commentCount = normalized;
        if (countEl) {
            countEl.textContent = String(normalized);
        }
    };

    const refreshList = () => {
        if (listEl) {
            listEl.innerHTML = '';
        }
        if (emptyState) {
            emptyState.classList.remove('is-visible');
        }
        if (errorState) {
            errorState.classList.remove('is-visible');
            errorState.textContent = '';
        }
    };

    const renderComments = (items) => {
        if (!listEl) return;
        listEl.innerHTML = '';
        if (!items.length) {
            emptyState?.classList.add('is-visible');
            return;
        }

        emptyState?.classList.remove('is-visible');
        items.forEach((comment) => {
            const item = document.createElement('li');
            item.className = 'public-script-comments-panel__comment';
            item.innerHTML = `
                <div class="public-script-comments-panel__comment-header">
                    <span>${escapeHtml(comment.authorLabel)}</span>
                    <span>${formatRelativeTime(comment.createdAt)}</span>
                </div>
                <p class="public-script-comments-panel__comment-content">${escapeHtml(comment.content)}</p>
            `;
            listEl.appendChild(item);
        });
    };

    const toggleLoader = (show) => {
        loader?.classList.toggle('is-visible', show);
    };

    const loadComments = async () => {
        if (!currentScriptId || isLoading) return;
        isLoading = true;
        toggleLoader(true);
        if (errorState) {
            errorState.classList.remove('is-visible');
            errorState.textContent = '';
        }
        try {
            const response = await api.getPublicScriptComments(currentScriptId, {
                page: 1,
                pageSize: COMMENT_PAGE_SIZE
            });
            comments = Array.isArray(response?.comments) ? response.comments : [];
            hasLoadedComments = true;
            const nextCount = typeof response?.count === 'number' ? response.count : comments.length;
            updateCommentCount(nextCount);
            renderComments(comments);
        } catch (error) {
            if (errorState) {
                errorState.textContent = 'Unable to load comments.';
                errorState.classList.add('is-visible');
            }
        } finally {
            isLoading = false;
            toggleLoader(false);
        }
    };

    const openPanel = () => {
        if (isPanelOpen) return;
        panel.classList.add('public-script-comments-panel--open');
        panel.setAttribute('aria-hidden', 'false');
        toggleButton.setAttribute('aria-expanded', 'true');
        backdrop?.classList.add('is-visible');
        isPanelOpen = true;
        if (!hasLoadedComments) {
            loadComments();
        }
    };

    const closePanel = () => {
        if (!isPanelOpen) return;
        panel.classList.remove('public-script-comments-panel--open');
        panel.setAttribute('aria-hidden', 'true');
        toggleButton.setAttribute('aria-expanded', 'false');
        backdrop?.classList.remove('is-visible');
        isPanelOpen = false;
    };

    const updateComposerState = () => {
        const hasText = textarea?.value.trim().length > 0;
        const disabled = !isAuthenticated || isPosting;
        if (textarea) {
            textarea.disabled = disabled;
        }
        if (submitButton) {
            submitButton.disabled = disabled || !hasText;
        }
        loginNotice?.classList.toggle('is-visible', !isAuthenticated);
    };

    const handlePieceSubmit = async (event) => {
        event.preventDefault();
        if (!currentScriptId || !textarea || isPosting || !isAuthenticated) return;
        const content = textarea.value.trim();
        if (!content) return;
        isPosting = true;
        updateComposerState();
        try {
            const payload = await api.addPublicScriptComment(currentScriptId, content);
            if (payload?.comment) {
                comments = [payload.comment, ...comments];
                renderComments(comments);
                emptyState?.classList.toggle('is-visible', comments.length === 0);
            }
            const nextCount = typeof payload?.count === 'number' ? payload.count : commentCount + 1;
            updateCommentCount(nextCount);
            textarea.value = '';
        } catch (error) {
            if (errorState) {
                errorState.textContent = 'Unable to post your comment.';
                errorState.classList.add('is-visible');
            }
        } finally {
            isPosting = false;
            updateComposerState();
        }
    };

    const handleToggleClick = () => {
        if (isPanelOpen) {
            closePanel();
        } else {
            openPanel();
        }
    };

    const handleLoginHint = () => {
        authWidget?.setAuthMode('login');
        const loginInput = document.querySelector('#email');
        if (loginInput) {
            loginInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            loginInput.focus();
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            closePanel();
        }
    };

    toggleButton.addEventListener('click', handleToggleClick);
    closeButton?.addEventListener('click', closePanel);
    backdrop?.addEventListener('click', closePanel);
    document.addEventListener('keydown', handleKeyDown);
    loginTrigger?.addEventListener('click', handleLoginHint);
    textarea?.addEventListener('input', updateComposerState);
    composerForm?.addEventListener('submit', handlePieceSubmit);

    stateManager.subscribe(StateManager.KEYS.AUTHENTICATED, (value) => {
        isAuthenticated = Boolean(value);
        updateComposerState();
    });

    updateComposerState();
    updateToggleState(false);

    return {
        setScriptId (id) {
            currentScriptId = id;
            hasLoadedComments = false;
            comments = [];
            refreshList();
            updateToggleState(Boolean(id));
            updateCommentCount(0);
            if (id) {
                panel.setAttribute('aria-hidden', 'true');
                toggleButton.setAttribute('aria-expanded', 'false');
            } else {
                closePanel();
            }
        },
        setCommentCount (value) {
            updateCommentCount(value);
        }
    };
};

const initPublicScriptViewer = async () => {
    renderSharedTopBar();
    const elements = getTopBarElements();
    const api = new ScriptPalAPI();
    const stateManager = new StateManager();
    const eventManager = new EventManager();
    const user = new ScriptPalUser(api);
    const { authWidget } = await initSharedTopBarWidgets(api, user, stateManager, eventManager, elements);

    const slug = getSlugFromPath();
    const scriptId = getQueryParam('id');
    const viewerLines = document.querySelector('.public-script-viewer__lines');
    const titleEl = document.querySelector('.public-script-viewer__title');
    const authorEl = document.querySelector('[data-script-author]');
    const thumbEl = document.querySelector('.public-script-viewer__thumb');
    const metadataEl = document.querySelector('.public-script-viewer__metadata');
    const metadataVersionEl = metadataEl?.querySelector('[data-script-version]');
    const ownerEl = document.querySelector('.public-script-owner');

    const commentsPanelController = setupCommentsPanel(api, authWidget, stateManager);
    commentsPanelController?.setScriptId(null);

    if (!slug && !scriptId) {
        setViewerMessage(viewerLines, 'No script selected.', false);
        return;
    }

    try {
        const script = slug
            ? await api.getPublicScriptBySlug(slug)
            : await api.getPublicScript(scriptId);
        if (!script) {
            commentsPanelController?.setScriptId(null);
            setViewerMessage(viewerLines, 'Script is not available.', true);
            return;
        }

        if (titleEl) {
            titleEl.textContent = script.title || 'Untitled Script';
        }

        if (authorEl) {
            const authorName = typeof script.author === 'string' ? script.author.trim() : '';
            authorEl.textContent = authorName ? `by ${authorName}` : 'Author not specified';
        }

        if (metadataVersionEl) {
            metadataVersionEl.textContent = `Updated ${new Date(script.updatedAt).toLocaleString()}`;
        }

        if (thumbEl) {
            thumbEl.src = script.coverUrl || '/images/screenplay-thumb.svg';
        }

        // if (ownerEl) {
            // ownerEl.textContent = script.owner?.email ? `Owned by ${script.owner.email}` : 'Owner not available';
        // }

        renderStaticScriptLines(viewerLines, script.content || '');
        commentsPanelController?.setScriptId(script.id);
        commentsPanelController?.setCommentCount(script.commentCount || 0);
    } catch (error) {
        console.error('[PublicScriptViewer] Failed to load script:', error);
        commentsPanelController?.setScriptId(null);
        setViewerMessage(viewerLines, 'Unable to load script.', true);
    }
};

initPublicScriptViewer();
