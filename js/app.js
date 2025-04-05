import { ScriptPalAPI } from './api.js';
import { ScriptPalChat } from './chat.js';
import { ScriptPalUI } from './ui.js';
import { ScriptPalUser } from './user.js';
import { ScriptPalScript } from './script.js';
import { EditorWidget } from './widgets/editor/EditorWidget.js';

export class ScriptPal {
    constructor() {
        // Wait for DOM to be ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init().catch(error => {
                console.error('ScriptPal initialization failed:', error);
            }));
        } else {
            this.init().catch(error => {
                console.error('ScriptPal initialization failed:', error);
            });
        }
    }

    async init() {
        try {
            // Initialize core components
            this.api = new ScriptPalAPI();
            this.user = new ScriptPalUser(this.api);

            // Check authentication first
            const isAuthenticated = await this.user.checkSession();
            const currentUser = this.user.getCurrentUser();

            // Create UI first to get managers
            this.ui = new ScriptPalUI(null, this.user, null);
            await this.ui.initialize(currentUser);

            // Initialize authenticated components
            if (isAuthenticated && currentUser) {
                // Create chat first since script depends on it
                this.chat = new ScriptPalChat(this.api, this.user);
                await this.chat.initialize();

                // Create and initialize script with chat
                this.script = new ScriptPalScript(this.api, this.user, this.chat);
                // Set managers before initialization
                this.script.setManagers(this.ui.stateManager, this.ui.eventBus);
                await this.script.initialize();

                // Get editor container element
                const editorElements = {
                    editorContainer: document.getElementById('editor-container'),
                    minimapContainer: document.getElementById('minimap-container')
                };

                // Validate required elements
                if (!editorElements.editorContainer) {
                    throw new Error('Editor container element not found in DOM');
                }

                // Create and initialize editor widget
                this.editor = new EditorWidget(editorElements);

                // Initialize with dependencies
                console.log('script:::', this.script);
                await this.editor.initialize(this.api, this.user, this.script)
                    .catch(error => {
                        console.error('Failed to initialize editor:', error);
                        throw new Error(`Editor initialization failed: ${error.message}`);
                    });

                // Update UI with authenticated components
                this.ui.updateComponents(this.chat, this.script, this.editor);

            } else {
                // Create empty chat and script for unauthenticated state
                this.chat = new ScriptPalChat(this.api, this.user);
                this.script = new ScriptPalScript(this.api, this.user, this.chat);
                // Set managers before initialization
                this.script.setManagers(this.ui.stateManager, this.ui.eventBus);
                await this.script.initialize();
            }

            // Get welcome buttons regardless of auth state
            // TODO: Add welcome buttons back in
            /*
            const randomButtons = await this.api.getRandomButtons();
            const buttonContainerRenderer = RendererFactory.createButtonContainerRenderer(this.ui.elements.messagesContainer);
            buttonContainerRenderer.render(randomButtons.buttons, (text) => {
                if (this.ui.widgets.chat && this.ui.widgets.chat.manager) {
                    this.ui.widgets.chat.manager.handleSend(text);
                }
            });
            */

        } catch (error) {
            console.error('Initialization failed:', error);
            throw new Error(`Failed to initialize ScriptPal: ${error.message}`);
        }
    }

    // Format buttons with keyboard shortcuts
    createFormatButtons() {
        Object.entries(this.formats).forEach(([key, value]) => {
            const button = this.createElement('button', 'format-button', key.toLowerCase());
            button.dataset.format = value;
            button.title = `Format as ${key.toLowerCase()} (${this.getShortcutText(key)})`;
            this.toolbar.appendChild(button);
        });
    }

    // Handle button clicks
    handleToolbarClick(e) {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('undo-button')) {
            if (this.undoHandler) this.undoHandler();
        } else if (button.classList.contains('redo-button')) {
            if (this.redoHandler) this.redoHandler();
        } else if (button.dataset.format) {
            const handler = this.formatHandlers.get(button.dataset.format);
            if (handler) handler();
        }
    }

    // EditorToolbar shows shortcuts but they're not implemented
    getShortcutText(key) {
        switch (key) {
            case 'HEADER':
                return 'Ctrl+H';
            case 'ACTION':
                return 'Ctrl+Shift+A';
                // ...
        }
    }

    loadInitialContent() {
        if (this.script && this.script.getCurrentContent()) {
            const content = this.script.getCurrentContent();
            this.content.setContent(content);
            console.log('Content set:', content);
            this.autosave.setLastSavedContent(content);
        }
    }

    destroy() {
        [this.toolbar, this.content, this.history, this.autosave]
        .filter(Boolean)
            .forEach(component => component.destroy());
        // ...
    }
}

// Export the class for use in other files
export default ScriptPal;