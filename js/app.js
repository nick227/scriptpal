import { ScriptPalAPI } from './api.js';
import { ScriptPalChat } from './chat.js';
import { ScriptPalUI } from './ui.js';
import { ScriptPalUser } from './user.js';
import { ScriptPalScript } from './script.js';
import { ERROR_MESSAGES } from './constants.js';

export class ScriptPal {
    constructor() {
        this.init().catch(error => {
            console.error('ScriptPal initialization failed:', error);
        });
    }

    async init() {
        try {
            this.api = new ScriptPalAPI();
            this.user = new ScriptPalUser(this.api);
            this.ui = new ScriptPalUI(null, this.user, null);

            // Check session first
            const isAuthenticated = await this.user.checkSession();
            const currentUser = this.user.getCurrentUser();

            if (isAuthenticated) {
                // Initialize other components only if authenticated
                this.chat = new ScriptPalChat(this.api, this.user);
                await this.chat.initialize();

                this.script = new ScriptPalScript(this.api, this.user);
                await this.script.initialize();

                // Update UI with authenticated components
                this.ui.updateComponents(this.chat, this.script);
            }

            // Initialize UI last, after all components are ready
            await this.ui.initialize(currentUser);

        } catch (error) {
            console.error('Initialization failed:', error);
            throw new Error(`Failed to initialize ScriptPal: ${error.message}`);
        }
    }
}

// Export the class for use in other files
export default ScriptPal;