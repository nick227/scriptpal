import { BaseWidget } from '../BaseWidget.js';
import { StateManager } from '../../core/StateManager.js';
import { EventManager } from '../../core/EventManager.js';
import { ButtonElementRenderer } from '../../renderers.js';
import { UI_ELEMENTS } from '../../constants.js';
export class ScriptWidget extends BaseWidget {
    constructor(elements) {
        super(elements);
        this.scriptManager = null;
        this.buttonRenderer = null;
        this.scriptsListContainer = null;
    }

    async initialize(scriptManager) {
        alert('initialize ScriptWidget');
        if (!scriptManager) {
            throw new Error('ScriptManager is required for ScriptWidget initialization');
        }

        this.scriptManager = scriptManager;
        await super.initialize();
        this.buttonRenderer = new ButtonElementRenderer(this.renderer.container);

        // Load initial scripts if we have a user
        const currentUser = this.stateManager.getState(StateManager.KEYS.USER);
        if (currentUser) {
            await this.loadUserScripts(currentUser.id);
        }
    }

    setupEventListeners() {
        this.subscribe(EventManager.EVENTS.SCRIPT.UPDATED, this.handleScriptUpdate.bind(this));
        this.subscribe(EventManager.EVENTS.SCRIPT.CREATED, this.handleScriptCreated.bind(this));
        this.subscribe(EventManager.EVENTS.SCRIPT.DELETED, this.handleScriptDeleted.bind(this));
        this.subscribe(EventManager.EVENTS.AUTH.LOGIN_SUCCESS, this.handleUserLogin.bind(this));
    }

    setupStateSubscriptions() {
        this.subscribeToState(StateManager.KEYS.SCRIPTS, this.handleScriptsUpdate.bind(this));
        this.subscribeToState(StateManager.KEYS.CURRENT_SCRIPT, this.handleCurrentScriptUpdate.bind(this));
    }

    async loadUserScripts(userId) {
        try {
            await this.scriptManager.loadScripts(userId);
        } catch (error) {
            console.error('Error loading user scripts:', error);
        }
    }

    handleScriptsUpdate(scripts) {
        if (!scripts || !this.scriptsListContainer) return;

        // Clear existing scripts
        this.scriptsListContainer.innerHTML = '';

        // Add each script
        scripts.forEach(script => {
            const scriptElement = this.createScriptElement(script);
            this.scriptsListContainer.appendChild(scriptElement);
        });

        // Update active state
        const currentScriptId = this.scriptManager.getCurrentScriptId();
        if (currentScriptId) {
            this.updateActiveScript(currentScriptId);
        }
    }

    createScriptElement(script) {
        // Create li element
        const li = document.createElement('li');
        li.className = 'script-item-container';

        // Create link element
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'script-item';
        link.textContent = script.title;
        link.dataset.scriptId = script.id;

        // Add click handler
        link.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleScriptSelect(script);
        });

        // Add link to li
        li.appendChild(link);
        return li;
    }

    handleCurrentScriptUpdate(script) {
        if (script) {
            this.updateActiveScript(script.id);
        }
    }

    updateActiveScript(scriptId) {
        if (!this.scriptsListContainer) return;

        // Remove active class from all scripts
        const allScripts = this.scriptsListContainer.querySelectorAll('.script-item');
        allScripts.forEach(script => script.classList.remove('active'));

        // Add active class to current script
        const activeScript = this.scriptsListContainer.querySelector(`[data-script-id="${scriptId}"]`);
        if (activeScript) {
            activeScript.classList.add('active');
        }
    }

    handleScriptSelect(script) {
        if (script && script.id) {
            this.scriptManager.loadScript(script.id);
        }
    }

    handleScriptCreated(script) {
        if (script && this.scriptsListContainer) {
            const scriptElement = this.createScriptElement(script);
            this.scriptsListContainer.appendChild(scriptElement);
        }
    }

    handleScriptDeleted(scriptId) {
        if (!scriptId || !this.scriptsListContainer) return;

        const scriptElement = this.scriptsListContainer.querySelector(`li:has([data-script-id="${scriptId}"])`);
        if (scriptElement) {
            scriptElement.remove();
        }
    }

    handleUserLogin(user) {
        if (user) {
            this.loadUserScripts(user.id);
        }
    }

    update(scriptManager) {
        if (scriptManager) {
            this.scriptManager = scriptManager;
        }
    }

    destroy() {
        // Remove the scripts list container if it exists
        if (this.scriptsListContainer && this.scriptsListContainer.parentNode) {
            this.scriptsListContainer.parentNode.removeChild(this.scriptsListContainer);
        }

        super.destroy();
        this.buttonRenderer = null;
        this.scriptsListContainer = null;
    }
}