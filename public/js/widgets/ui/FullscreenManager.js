/**
 * FullscreenManager - Manages fullscreen mode for the application
 * Hides top bar and navbar, maximizes screen height for pages
 */

import { EventManager } from '../../core/EventManager.js';
import { debugLog } from '../../core/logger.js';
import { loadJsonFromStorage, saveJsonToStorage } from '../../services/persistence/PersistenceManager.js';

/**
 * FullscreenManager class for managing fullscreen mode
 */
export class FullscreenManager {
    /**
     * Constructor
     * @param {object} options - Configuration options
     * @param {object} options.stateManager - State manager for persistence
     * @param {object} options.eventManager - Event manager for notifications
     */
    constructor (options) {
        if (!options.stateManager) {
            throw new Error('StateManager is required for FullscreenManager');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for FullscreenManager');
        }

        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;

        // Fullscreen state
        this.isFullscreen = false;
        this.originalStyles = new Map();
        this.hiddenElements = [];
        this.failureCount = 0;
        this.maxFailures = 3; // Circuit breaker threshold for fullscreen

        // UI elements
        this.navbar = null;
        this.topBar = null;
        this.containerMain = null;
        this.editorContainer = null;
        this.chatContainer = null;

        // Event handlers
        this.eventHandlers = new Map();

        // Initialize
        this.initialize();
    }

    /**
     * Initialize the fullscreen manager
     */
    async initialize () {

        // Find UI elements
        this.findUIElements();

        // Set up event listeners
        this.setupEventListeners();

        // Load saved state
        await this.loadState();

        // Apply initial state with a delay to prevent initialization conflicts
        setTimeout(() => {
            this.applyFullscreenState();
        }, 100);

    }

    /**
     * Check if the document is in native fullscreen mode
     * @returns {boolean} - True if in native fullscreen mode
     */
    isInNativeFullscreen () {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }

    /**
     * Check if there's a script loading error in progress
     * @returns {boolean} - True if script loading error is active
     */
    isScriptLoadingError () {
        // Check if there are recent script error messages in console or DOM
        const errorElements = document.querySelectorAll('.error-message, .script-error');
        return errorElements.length > 0;
    }

    /**
     * Find UI elements
     */
    findUIElements () {
        this.navbar = document.querySelector('.navbar');
        this.topBar = document.querySelector('.button-set.site-controls');
        this.containerMain = document.querySelector('.container-main');
        this.editorContainer = document.querySelector('.editor-container');
        this.chatContainer = document.querySelector('.chatbot-container');

        debugLog('[FullscreenManager] Found elements:', {
            navbar: !!this.navbar,
            topBar: !!this.topBar,
            containerMain: !!this.containerMain,
            editorContainer: !!this.editorContainer,
            chatContainer: !!this.chatContainer
        });
    }

    /**
     * Set up event listeners
     */
    setupEventListeners () {
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Fullscreen API events
        document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
        document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
        document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
        document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));

        // Window resize
        window.addEventListener('resize', this.handleWindowResize.bind(this));

        // Listen for fullscreen toggle events
        this.eventManager.subscribe(EventManager.EVENTS.UI.FULLSCREEN_TOGGLE, this.toggleFullscreen.bind(this));
    }

    /**
     * Handle key down events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown (event) {
        // F11 to toggle fullscreen
        if (event.key === 'F11') {
            event.preventDefault();
            this.toggleFullscreen();
        }

        // Escape to exit fullscreen
        if (event.key === 'Escape' && this.isFullscreen) {
            this.exitFullscreen();
        }

        // Ctrl+Shift+F to toggle fullscreen
        if (event.ctrlKey && event.shiftKey && event.key === 'F') {
            event.preventDefault();
            this.toggleFullscreen();
        }
    }

    /**
     * Handle fullscreen change events
     * @param {Event} event - Fullscreen change event
     * @param _event
     */
    handleFullscreenChange (_event) {
        const isFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        if (isFullscreen !== this.isFullscreen) {
            this.isFullscreen = isFullscreen;
            this.applyFullscreenState();
            this.saveState();

            // Emit event
            this.eventManager.publish(EventManager.EVENTS.UI.FULLSCREEN_CHANGED, {
                isFullscreen: this.isFullscreen
            });
        }
    }

    /**
     * Handle window resize
     * @param {Event} event - Window resize event
     * @param _event
     */
    handleWindowResize (_event) {
        if (this.isFullscreen) {
            this.applyFullscreenState();
        }
    }

    /**
     * Toggle fullscreen mode
     */
    async toggleFullscreen () {
        // Circuit breaker: prevent repeated fullscreen errors
        if (this.failureCount >= this.maxFailures) {
            return;
        }

        // Prevent fullscreen operations during script loading errors
        if (this.isScriptLoadingError()) {
            return;
        }

        if (this.isFullscreen) {
            await this.exitFullscreen();
        } else {
            await this.enterFullscreen();
        }
    }

    /**
     * Enter fullscreen mode
     */
    async enterFullscreen () {
        try {
            // Use native fullscreen API if available
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                await document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.mozRequestFullScreen) {
                await document.documentElement.mozRequestFullScreen();
            } else if (document.documentElement.msRequestFullscreen) {
                await document.documentElement.msRequestFullscreen();
            }

            // Always apply custom fullscreen state
            this.isFullscreen = true;
            this.enterFullscreenMode();

            // Update state manager
            this.stateManager.setState('isFullscreen', true);

            // Emit event
        this.eventManager.publish(EventManager.EVENTS.UI.FULLSCREEN_CHANGED, { isFullscreen: true });


        } catch (error) {
            console.error('[FullscreenManager] Failed to enter fullscreen:', error);
            // Don't apply state if fullscreen request was denied
            if (error.name === 'NotAllowedError' || error.message.includes('denied')) {
                console.warn('[FullscreenManager] Fullscreen request denied, staying in current mode');
                return;
            }
            // Fallback to custom fullscreen for other errors
            this.isFullscreen = true;
            this.enterFullscreenMode();
            this.stateManager.setState('isFullscreen', true);
            this.eventManager.publish(EventManager.EVENTS.UI.FULLSCREEN_CHANGED, { isFullscreen: true });
        }

        this.saveState();
    }

    /**
     * Exit fullscreen mode
     */
    async exitFullscreen () {
        try {
            // Check if we're actually in fullscreen mode
            if (!this.isFullscreen && !this.isInNativeFullscreen()) {
                return;
            }

            // Use native fullscreen API if available
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }

            // Always apply custom fullscreen state
            this.isFullscreen = false;
            this.exitFullscreenMode();

            // Update state manager
            this.stateManager.setState('isFullscreen', false);

            // Emit event
            this.eventManager.publish(EventManager.EVENTS.UI.FULLSCREEN_CHANGED, { isFullscreen: false });

            // Reset failure count on success
            this.failureCount = 0;

        } catch (error) {
            console.error('[FullscreenManager] Failed to exit fullscreen:', error);
            // Don't apply state if we're not in fullscreen mode
            if (error.message.includes('Not in fullscreen mode')) {
                console.warn('[FullscreenManager] Not in fullscreen mode, skipping exit');
                this.isFullscreen = false;
                return;
            }
            // Increment failure count for circuit breaker
            this.failureCount++;
            // Fallback to custom fullscreen for other errors
            this.isFullscreen = false;
            this.applyFullscreenState();
        }

        this.saveState();
    }

    /**
     * Apply fullscreen state
     */
    applyFullscreenState () {
        try {
            // Only apply state if it's different from current state
            const currentlyInFullscreen = document.body.classList.contains('fullscreen-mode');

            if (this.isFullscreen && !currentlyInFullscreen) {
                this.enterFullscreenMode();
            } else if (!this.isFullscreen && currentlyInFullscreen) {
                this.exitFullscreenMode();
            }
        } catch (error) {
            console.error('[FullscreenManager] Error applying fullscreen state:', error);
        }
    }

    /**
     * Enter fullscreen mode (custom implementation)
     */
    enterFullscreenMode () {
        // Hide navbar and top bar
        this.hideElement(this.navbar);
        this.hideElement(this.topBar);

        // Apply fullscreen styles to main container
        if (this.containerMain) {
            this.saveElementStyles(this.containerMain);
            this.containerMain.style.position = 'fixed';
            this.containerMain.style.top = '0';
            this.containerMain.style.left = '0';
            this.containerMain.style.width = '100vw';
            this.containerMain.style.height = '100vh';
            this.containerMain.style.zIndex = '1000';
            this.containerMain.classList.add('fullscreen-mode');
        }

        // Apply fullscreen styles to editor container
        if (this.editorContainer) {
            this.saveElementStyles(this.editorContainer);
            this.editorContainer.style.height = '100vh';
            this.editorContainer.style.maxHeight = '100vh';
            this.editorContainer.classList.add('fullscreen-editor');
        }

        // Adjust chat container for fullscreen
        if (this.chatContainer) {
            this.chatContainer.classList.add('fullscreen-chat');
        }

        // Add fullscreen class to body
        document.body.classList.add('fullscreen-mode');

        // Emit event
        this.eventManager.publish(EventManager.EVENTS.UI.FULLSCREEN_ENTERED, {});
    }

    /**
     * Exit fullscreen mode (custom implementation)
     */
    exitFullscreenMode () {
        // Show navbar and top bar
        this.showElement(this.navbar);
        this.showElement(this.topBar);

        // Restore main container styles
        if (this.containerMain) {
            this.restoreElementStyles(this.containerMain);
            this.containerMain.classList.remove('fullscreen-mode');
        }

        // Restore editor container styles
        if (this.editorContainer) {
            this.restoreElementStyles(this.editorContainer);
            this.editorContainer.classList.remove('fullscreen-editor');
        }

        // Restore chat container
        if (this.chatContainer) {
            this.chatContainer.classList.remove('fullscreen-chat');
        }

        // Remove fullscreen class from body
        document.body.classList.remove('fullscreen-mode');

        // Emit event
        this.eventManager.publish(EventManager.EVENTS.UI.FULLSCREEN_EXITED, {});
    }

    /**
     * Hide element and save its original display style
     * @param {HTMLElement} element - Element to hide
     */
    hideElement (element) {
        if (element && element.style.display !== 'none') {
            this.originalStyles.set(element, element.style.display);
            element.style.display = 'none';
            this.hiddenElements.push(element);
        }
    }

    /**
     * Show element and restore its original display style
     * @param {HTMLElement} element - Element to show
     */
    showElement (element) {
        if (element) {
            const originalDisplay = this.originalStyles.get(element);
            if (originalDisplay !== undefined) {
                element.style.display = originalDisplay;
            } else {
                element.style.display = '';
            }
            this.originalStyles.delete(element);

            // Remove from hidden elements
            const index = this.hiddenElements.indexOf(element);
            if (index > -1) {
                this.hiddenElements.splice(index, 1);
            }
        }
    }

    /**
     * Save element styles
     * @param {HTMLElement} element - Element to save styles for
     */
    saveElementStyles (element) {
        if (element) {
            const styles = {
                position: element.style.position,
                top: element.style.top,
                left: element.style.left,
                width: element.style.width,
                height: element.style.height,
                maxHeight: element.style.maxHeight,
                zIndex: element.style.zIndex
            };
            this.originalStyles.set(element, styles);
        }
    }

    /**
     * Restore element styles
     * @param {HTMLElement} element - Element to restore styles for
     */
    restoreElementStyles (element) {
        if (element) {
            const styles = this.originalStyles.get(element);
            if (styles) {
                Object.assign(element.style, styles);
                this.originalStyles.delete(element);
            }
        }
    }

    /**
     * Load state from storage
     */
    async loadState () {
        try {
            const state = loadJsonFromStorage('fullscreenState');
            if (state) {
                this.isFullscreen = state.isFullscreen || false;
            }
        } catch (error) {
            console.warn('[FullscreenManager] Failed to load state:', error);
        }
    }

    /**
     * Save state to storage
     */
    async saveState () {
        try {
            const state = {
                isFullscreen: this.isFullscreen
            };
            saveJsonToStorage('fullscreenState', state);
        } catch (error) {
            console.warn('[FullscreenManager] Failed to save state:', error);
        }
    }

    /**
     * Get current fullscreen state
     * @returns {boolean} - Whether in fullscreen mode
     */
    getFullscreenState () {
        return this.isFullscreen;
    }

    /**
     * Set fullscreen state
     * @param {boolean} isFullscreen - Whether to be in fullscreen mode
     */
    setFullscreenState (isFullscreen) {
        if (isFullscreen !== this.isFullscreen) {
            this.isFullscreen = isFullscreen;
            this.applyFullscreenState();
            this.saveState();
        }
    }

    /**
     * Check if fullscreen is supported
     * @returns {boolean} - Whether fullscreen is supported
     */
    isFullscreenSupported () {
        return !!(
            document.documentElement.requestFullscreen ||
            document.documentElement.webkitRequestFullscreen ||
            document.documentElement.mozRequestFullScreen ||
            document.documentElement.msRequestFullscreen
        );
    }

    /**
     * Get fullscreen API name
     * @returns {string} - The fullscreen API name being used
     */
    getFullscreenAPIName () {
        if (document.documentElement.requestFullscreen) {
            return 'standard';
        } else if (document.documentElement.webkitRequestFullscreen) {
            return 'webkit';
        } else if (document.documentElement.mozRequestFullScreen) {
            return 'moz';
        } else if (document.documentElement.msRequestFullscreen) {
            return 'ms';
        } else {
            return 'custom';
        }
    }

    /**
     * Create fullscreen toggle button
     * @returns {HTMLElement} - Fullscreen toggle button
     */
    createFullscreenToggleButton () {
        const button = document.createElement('button');
        button.className = 'fullscreen-toggle-button';
        button.innerHTML = this.isFullscreen ?
            '<i class="fas fa-compress"></i>' :
            '<i class="fas fa-expand"></i>';
        button.title = this.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';

        button.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        return button;
    }

    /**
     * Update fullscreen toggle button
     * @param {HTMLElement} button - Button to update
     */
    updateFullscreenToggleButton (button) {
        if (button) {
            button.innerHTML = this.isFullscreen ?
                '<i class="fas fa-compress"></i>' :
                '<i class="fas fa-expand"></i>';
            button.title = this.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
        }
    }

    /**
     * Destroy the manager
     */
    destroy () {
        // Exit fullscreen if active
        if (this.isFullscreen) {
            this.exitFullscreen();
        }

        // Clear event handlers
        this.eventHandlers.clear();

        // Clear references
        this.stateManager = null;
        this.eventManager = null;
        this.navbar = null;
        this.topBar = null;
        this.containerMain = null;
        this.editorContainer = null;
        this.chatContainer = null;
        this.originalStyles.clear();
        this.hiddenElements = [];

    }
}
