import { ScriptPalAPI } from './api.js';
import { ScriptPalChat } from './chat.js';
import { ScriptPalUI } from './ui.js';
import { ScriptPalUser } from './user.js';
import { ScriptPalScript } from './script.js';
import { RendererFactory } from './renderers.js';

export class ScriptPal {
    constructor() {
        this.init().catch(error => {
            console.error('ScriptPal initialization failed:', error);
        });
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

                // Update UI with authenticated components
                this.ui.updateComponents(this.chat, this.script);
            } else {
                // Create empty chat and script for unauthenticated state
                this.chat = new ScriptPalChat(this.api, this.user);
                this.script = new ScriptPalScript(this.api, this.user, this.chat);
                // Set managers before initialization
                this.script.setManagers(this.ui.stateManager, this.ui.eventBus);
                await this.script.initialize();
            }

            // Get welcome buttons regardless of auth state
            const randomButtons = await this.api.getRandomButtons();
            const buttonContainerRenderer = RendererFactory.createButtonContainerRenderer(this.ui.elements.messagesContainer);
            buttonContainerRenderer.render(randomButtons.buttons, (text) => {
                if (this.ui.widgets.chat && this.ui.widgets.chat.manager) {
                    this.ui.widgets.chat.manager.handleSend(text);
                }
            });

        } catch (error) {
            console.error('Initialization failed:', error);
            throw new Error(`Failed to initialize ScriptPal: ${error.message}`);
        }
    }
}

// Export the class for use in other files
export default ScriptPal;