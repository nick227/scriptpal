/**
 * ScriptListWidget - Manages script list dropdown and selection
 * Provides UI for viewing, selecting, creating, and managing multiple scripts
 */

import { StateManager } from '../../core/StateManager.js';
import { BaseWidget } from '../BaseWidget.js';

/**
 * ScriptListWidget class for managing script list UI
 */
export class ScriptListWidget extends BaseWidget {
    /**
     * Constructor
     * @param {object} options - Configuration options
     * @param {object} options.container - Container element for the widget
     * @param {object} options.stateManager - State manager for current script tracking
     * @param {object} options.scriptStore - Script store for commands
     */
    constructor (options) {
        super();

        if (!options.container) {
            throw new Error('Container is required for ScriptListWidget');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for ScriptListWidget');
        }
        if (!options.scriptStore) {
            throw new Error('ScriptStore is required for ScriptListWidget');
        }

        this.container = options.container;
        this.stateManager = options.stateManager;
        this.scriptStore = options.scriptStore;

        // Widget state
        this.scripts = [];
        this.currentScript = null;
        this.isLoading = false;
        this.isDropdownOpen = false;

        // UI elements
        this.dropdownTrigger = null;
        this.dropdownMenu = null;
        this.scriptList = null;
        this.createButton = null;
        this.loadingIndicator = null;

        // Initialize
        this.initialize();
    }

    /**
     * Initialize the script list widget
     */
    async initialize () {

        // Create UI elements
        this.createUI();

        // Set up event listeners
        this.setupEventListeners();

        // Prime with existing state
        this.handleScriptsStateUpdate(this.stateManager.getState(StateManager.KEYS.SCRIPTS));
        this.handleScriptChange(this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT));

    }

    /**
     * Create the UI elements
     */
    createUI () {
        // Clear container
        this.container.innerHTML = '';

        // Create main dropdown container
        const dropdownContainer = this.createElement('div', 'script-list-dropdown');
        this.container.appendChild(dropdownContainer);

        // Create dropdown trigger
        this.dropdownTrigger = this.createElement('button', 'script-dropdown-trigger');
        this.dropdownTrigger.innerHTML = `
            <span class="script-title">Select Script</span>
            <i class="fas fa-chevron-down dropdown-icon"></i>
        `;
        this.dropdownTrigger.title = 'Select Script';
        dropdownContainer.appendChild(this.dropdownTrigger);

        // Create dropdown menu
        this.dropdownMenu = this.createElement('div', 'script-dropdown-menu');
        this.dropdownMenu.style.display = 'none';
        dropdownContainer.appendChild(this.dropdownMenu);

        // Create script list
        this.scriptList = this.createElement('div', 'script-list');
        this.dropdownMenu.appendChild(this.scriptList);

        // Create create new script button
        this.createButton = this.createElement('button', 'create-script-button');
        this.createButton.innerHTML = '<i class="fas fa-plus"></i> New Script';
        this.createButton.title = 'Create New Script';
        this.dropdownMenu.appendChild(this.createButton);

        // Create loading indicator
        this.loadingIndicator = this.createElement('div', 'loading-indicator');
        this.loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        this.loadingIndicator.style.display = 'none';
        this.dropdownMenu.appendChild(this.loadingIndicator);

        // Add CSS classes for styling
        this.container.classList.add('script-list-widget');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners () {
        // Dropdown trigger click
        this.dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Create script button click
        this.createButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCreateScript();
        });

        // Click outside to close dropdown
        document.addEventListener('click', (e) => {
            if (this.container && !this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Listen for script changes
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));
        this.stateManager.subscribe(StateManager.KEYS.SCRIPTS, this.handleScriptsStateUpdate.bind(this));

    }

    /**
     * Update the script list UI
     */
    updateScriptList () {
        if (!this.scriptList) {
            return;
        }

        // Clear existing list
        this.scriptList.innerHTML = '';

        if (this.scripts.length === 0) {
            // Show empty state
            const emptyState = this.createElement('div', 'empty-state');
            emptyState.innerHTML = '<i class="fas fa-file-alt"></i><br>No scripts yet';
            this.scriptList.appendChild(emptyState);
            return;
        }

        // Create script items
        this.scripts.forEach(script => {
            const scriptItem = this.createScriptItem(script);
            this.scriptList.appendChild(scriptItem);
        });
    }

    /**
     * Create a script item element
     * @param {object} script - The script object
     * @returns {HTMLElement} - The script item element
     */
    createScriptItem (script) {
        const scriptItem = this.createElement('div', 'script-item');
        scriptItem.dataset.scriptId = script.id;

        // Create script info
        const scriptInfo = this.createElement('div', 'script-info');

        const title = this.createElement('div', 'script-item-title');
        title.textContent = script.title || 'Untitled Script';
        scriptInfo.appendChild(title);

        const meta = this.createElement('div', 'script-item-meta');
        meta.innerHTML = `
            <span class="script-date">${this.formatDate(script.updatedAt || script.createdAt)}</span>
            <span class="script-status">${script.status || 'draft'}</span>
        `;
        scriptInfo.appendChild(meta);

        scriptItem.appendChild(scriptInfo);

        // Create script actions
        const actions = this.createElement('div', 'script-actions');

        const selectButton = this.createElement('button', 'select-script-button');
        selectButton.innerHTML = '<i class="fas fa-check"></i>';
        selectButton.title = 'Select Script';
        selectButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSelectScript(script);
        });

        const deleteButton = this.createElement('button', 'delete-script-button');
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.title = 'Delete Script';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleDeleteScript(script);
        });

        actions.appendChild(selectButton);
        actions.appendChild(deleteButton);
        scriptItem.appendChild(actions);

        // Add click handler for the entire item
        scriptItem.addEventListener('click', (e) => {
            if (!e.target.closest('.script-actions')) {
                this.handleSelectScript(script);
            }
        });

        return scriptItem;
    }

    /**
     * Handle script selection
     * @param {object} script - The selected script
     */
    async handleSelectScript (script) {
        try {

            // Close dropdown
            this.closeDropdown();

            await this.scriptStore.selectScript(script.id, { source: 'list' });

        } catch (error) {
            console.error('[ScriptListWidget] Failed to select script:', error);
            this.showError('Failed to select script');
        }
    }

    /**
     * Handle script deletion
     * @param {object} script - The script to delete
     */
    async handleDeleteScript (script) {

        if (!confirm(`Are you sure you want to delete "${script.title}"?`)) {
            return;
        }

        try {
            const currentScriptId = this.currentScript ? String(this.currentScript.id) : null;
            const scriptId = String(script.id);

            const deletionMarked = await this.scriptStore.deleteScript(script.id);
            if (!deletionMarked) {
                return;
            }

            const remainingScripts = this.scripts.filter(item => String(item.id) !== scriptId);
            if (remainingScripts.length !== this.scripts.length) {
                this.scripts = remainingScripts;
                this.updateScriptList();
            }

            if (currentScriptId && currentScriptId === scriptId) {
                const nextScript = remainingScripts[0] || null;
                if (nextScript) {
                    await this.scriptStore.selectScript(nextScript.id, { source: 'delete' });
                } else {
                    this.setCurrentScript(null);
                }
            }

        } catch (error) {
            console.error('[ScriptListWidget] Failed to delete script:', error);
            this.showError('Failed to delete script');
        }
    }

    /**
     * Handle create new script
     */
    async handleCreateScript () {
        try {

            const title = prompt('Enter script title:');
            if (!title || !title.trim()) {
                return;
            }

            const user = this.stateManager.getState(StateManager.KEYS.USER);
            await this.scriptStore.createScript(user.id, {
                title: title.trim(),
                content: ''
            });

        } catch (error) {
            console.error('[ScriptListWidget] Failed to create script:', error);
            this.showError('Failed to create script');
        }
    }

    /**
     * Set the current script
     * @param {object|null} script - The current script
     */
    setCurrentScript (script) {
        this.currentScript = script;

        if (script) {
            this.dropdownTrigger.querySelector('.script-title').textContent = script.title || 'Untitled Script';
            this.dropdownTrigger.classList.add('has-script');
        } else {
            this.dropdownTrigger.querySelector('.script-title').textContent = 'Select Script';
            this.dropdownTrigger.classList.remove('has-script');
        }

        // Update script items to show current selection
        this.updateScriptSelection();
    }

    /**
     * Update script selection in the list
     */
    updateScriptSelection () {
        const scriptItems = this.scriptList.querySelectorAll('.script-item');
        scriptItems.forEach(item => {
            const { scriptId } = item.dataset;
            if (this.currentScript && this.currentScript.id !== undefined && scriptId === this.currentScript.id.toString()) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Toggle dropdown visibility
     */
    toggleDropdown () {
        if (this.isDropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    /**
     * Open dropdown
     */
    openDropdown () {
        this.isDropdownOpen = true;
        this.dropdownMenu.style.display = 'block';
        this.dropdownTrigger.classList.add('open');
        this.dropdownTrigger.querySelector('.dropdown-icon').classList.add('open');
    }

    /**
     * Close dropdown
     */
    closeDropdown () {
        this.isDropdownOpen = false;
        this.dropdownMenu.style.display = 'none';
        this.dropdownTrigger.classList.remove('open');
        this.dropdownTrigger.querySelector('.dropdown-icon').classList.remove('open');
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether to show loading state
     */
    setLoading (loading) {
        this.isLoading = loading;

        if (loading) {
            this.loadingIndicator.style.display = 'block';
            this.scriptList.style.display = 'none';
        } else {
            this.loadingIndicator.style.display = 'none';
            this.scriptList.style.display = 'block';
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message to show
     */
    showError (message) {
        // Create temporary error message
        const errorDiv = this.createElement('div', 'error-message');
        errorDiv.textContent = message;
        errorDiv.style.color = '#ff4444';
        errorDiv.style.padding = '10px';
        errorDiv.style.textAlign = 'center';

        this.dropdownMenu.appendChild(errorDiv);

        // Remove after 3 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    /**
     * Handle script change from state manager
     * @param {object} script - The new current script
     */
    handleScriptChange (script) {
        this.setCurrentScript(script);
    }

    /**
     * Handle script list updates from state manager
     * @param {Array} scripts
     */
    handleScriptsStateUpdate (scripts) {
        this.scripts = Array.isArray(scripts) ? scripts : [];
        this.updateScriptList();
    }

    /**
     * Format date for display
     * @param {string} dateString - Date string to format
     * @returns {string} - Formatted date
     */
    formatDate (dateString) {
        if (!dateString) {
            return 'Unknown';
        }

        const date = new Date(dateString);
        const now = new Date();
        const dayMs = 1000 * 60 * 60 * 24;
        const diffDays = Math.floor((
            Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
            Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
        ) / dayMs);

        if (diffDays <= 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Refresh the script list
     */
    async refresh () {
        const user = this.stateManager.getState(StateManager.KEYS.USER);
        await this.scriptStore.loadScripts(user.id, { force: true });
    }

    /**
     * Get current scripts
     * @returns {Array} - Array of scripts
     */
    getScripts () {
        return this.scripts;
    }

    /**
     * Get current script
     * @returns {object|null} - Current script or null
     */
    getCurrentScript () {
        return this.currentScript;
    }

    /**
     * Destroy the widget
     */
    destroy () {
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        // Clear references
        this.container = null;
        this.stateManager = null;
        this.scriptStore = null;
        this.scripts = [];
        this.currentScript = null;

    }
}
