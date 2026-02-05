import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { ERROR_MESSAGES } from '../../constants.js';
import { getMineSlugFromPathname, buildMinePath } from './slugPaths.js';

/**
 * ScriptsController - handles script UI intent and editor sync
 */
export class ScriptsController {
    /**
     * Create a scripts controller.
     * @param {object} options - Dependency container.
     * @param {object} options.scriptStore - Script store instance.
     * @param {StateManager} options.stateManager - Global state manager.
     * @param {EventManager} options.eventManager - Event manager instance.
     */
    constructor (options) {
        if (!options.scriptStore) {
            throw new Error('ScriptStore is required for ScriptsController');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for ScriptsController');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for ScriptsController');
        }

        this.scriptStore = options.scriptStore;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.editorWidget = null;
        this.editorReady = false;
        this.lastLoadedScriptId = null;
        this.lastLoadedVersion = null;

        this.setupEventSubscriptions();
        this.setupStateSubscriptions();
    }

    /**
     * Wire up event subscriptions.
     */
    setupEventSubscriptions () {
        this.eventManager.subscribe(
            EventManager.EVENTS.SCRIPT.SELECTED,
            this.handleScriptSelected.bind(this)
        );
    }

    /**
     * Wire up state subscriptions.
     */
    setupStateSubscriptions () {
        this.stateManager.subscribe(
            StateManager.KEYS.USER,
            this.handleUserChange.bind(this)
        );
        this.stateManager.subscribe(
            StateManager.KEYS.CURRENT_SCRIPT_ERROR,
            this.handleScriptError.bind(this)
        );

        this.handleUserChange(this.stateManager.getState(StateManager.KEYS.USER));
    }

    /**
     * Attach the editor widget.
     * @param {object} editorWidget - Editor widget instance.
     * @param {boolean} isReady - Whether the editor is ready.
     */
    setEditorWidget (editorWidget, isReady = false) {
        this.editorWidget = editorWidget;
        this.editorReady = Boolean(isReady);

        if (this.editorWidget && this.editorReady) {
            this.handleCurrentScriptChange(this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT), {
                source: 'startup'
            });
        }
    }

    /**
     * React to user changes.
     * @param {object} user - Current user model.
     */
    async handleUserChange (user) {
        this.clearScriptNotFoundBanner();

        if (!user || !user.id) {
            this.scriptStore.clearState();
            return;
        }

        await this.scriptStore.ensureUserHasScripts(user.id);
        const slug = getMineSlugFromPathname();
        if (slug) {
            try {
                const loaded = await this.scriptStore.loadScriptBySlug(slug, { source: 'slug' });
                if (loaded) {
                    this.syncCanonicalSlugPath(slug, loaded.slug);
                    return;
                }
            } catch (error) {
                if (error && (error.status === 404 || error.type === 'slug_not_found')) {
                    const recovered = await this.recoverFromMissingSlug(slug);
                    if (recovered) {
                        return;
                    }
                    this.scriptStore.setScriptError({
                        type: 'slug_not_found',
                        slug,
                        status: 404,
                        message: ERROR_MESSAGES.SCRIPT_NOT_FOUND
                    });
                    return;
                }
                console.error('[ScriptsController] Unexpected slug load error', error);
            }
            this.scriptStore.setCurrentScript(null, { source: 'slug' });
            return;
        }

        await this.scriptStore.selectInitialScript({ source: 'startup' });
    }

    syncCanonicalSlugPath (requestedSlug, canonicalSlug) {
        if (!canonicalSlug || canonicalSlug === requestedSlug) {
            return;
        }
        const pathSlug = getMineSlugFromPathname();
        if (!pathSlug || pathSlug === canonicalSlug) {
            return;
        }
        if (typeof window === 'undefined') {
            return;
        }
        const nextPath = buildMinePath(canonicalSlug);
        window.history.replaceState({ scriptId: this.scriptStore.getCurrentScriptId() }, '', nextPath);
    }

    async recoverFromMissingSlug (slug) {
        const user = this.stateManager.getState(StateManager.KEYS.USER);
        if (!user || !user.id) {
            return false;
        }
        await this.scriptStore.ensureUserHasScripts(user.id);
        const scripts = this.scriptStore.getScripts();
        if (!scripts || scripts.length === 0) {
            return false;
        }
        const fallback = scripts[0];
        if (!fallback || !fallback.id) {
            return false;
        }
        try {
            await this.scriptStore.loadScript(fallback.id, { source: 'slug', forceFresh: true });
            return true;
        } catch (error) {
            console.error('[ScriptsController] Fallback script load failed after missing slug:', error);
            return false;
        }
    }

    handleScriptError (error) {
        if (error && error.type === 'slug_not_found' && error.slug) {
            this.displayScriptNotFoundBanner(error.slug);
            return;
        }
        this.clearScriptNotFoundBanner();
    }

    /**
     * React to script selection events.
     * @param {object} event - Selection event payload.
     */
    async handleScriptSelected (event) {
        const script = event && typeof event === 'object' ? event.script : null;
        const source = event && typeof event === 'object' ? event.source : null;
        if (source === 'update' || source === 'patch' || source === 'edit') {
            return;
        }
        await this.handleCurrentScriptChange(script, { source: source || 'selection' });
        this.updateUrlForScript(script, source);
    }

    /**
     * React to current script changes.
     * @param {object} script - Current script model.
     * @param {object} options - Load options.
     * @param {string} [options.source] - Event source.
     */
    async handleCurrentScriptChange (script, options = {}) {
        if (this.shouldSkipLoad(script)) {
            return;
        }

        await this.editorWidget.loadScript({
            script,
            source: options.source || 'selection',
            resetHistory: true
        });

        this.lastLoadedScriptId = script.id;
        this.lastLoadedVersion = script.versionNumber;
    }

    shouldSkipLoad (script) {
        if (!script || !this.editorWidget || !this.editorReady) {
            return true;
        }

        if (script.pending) {
            return true;
        }

        const isSameScript = this.lastLoadedScriptId !== null &&
            String(this.lastLoadedScriptId) === String(script.id);
        const isSameVersion = this.lastLoadedVersion !== null &&
            Number(this.lastLoadedVersion) === Number(script.versionNumber);

        return isSameScript && isSameVersion;
    }

    updateUrlForScript (script, source) {
        if (!script || !script.id) {
            return;
        }

        const nextPath = buildMinePath(script.slug);
        if (window.location.pathname === nextPath) {
            return;
        }

        if (source === 'slug' || source === 'startup') {
            window.history.replaceState({ scriptId: script.id }, '', nextPath);
            return;
        }

        window.history.pushState({ scriptId: script.id }, '', nextPath);
    }

    displayScriptNotFoundBanner (slug) {
        this.clearScriptNotFoundBanner();
        const banner = document.createElement('div');
        banner.className = 'script-not-found-banner';

        const message = document.createElement('p');
        message.className = 'script-not-found-banner__text';
        message.textContent = ERROR_MESSAGES.SCRIPT_NOT_FOUND;

        const slugText = document.createElement('p');
        slugText.className = 'script-not-found-banner__slug';
        slugText.textContent = slug;

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'View my scripts';
        button.addEventListener('click', () => {
            this.clearScriptNotFoundBanner();
            window.history.replaceState({}, '', '/mine');
            this.scriptStore.setCurrentScript(null, { source: 'slug' });
        });

        banner.appendChild(message);
        banner.appendChild(slugText);
        banner.appendChild(button);
        document.body.appendChild(banner);
    }

    clearScriptNotFoundBanner () {
        const existing = document.querySelector('.script-not-found-banner');
        if (existing) {
            existing.remove();
        }
    }

}
