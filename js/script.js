import { MessageRenderer } from './renderers.js';
import { MESSAGE_TYPES, UI_ELEMENTS } from './constants.js';


export class ScriptPalScript {
    constructor(api, user) {
        this.api = api;
        this.user = user;
        this.userId = this.user.currentUser.id;
        this.allScripts = null;
        this.currentScript = null;
        this.currentScriptId = null;
        this.messageRenderer = null;
        this.elements = {};
        this.initializeElements();
    }

    async initialize() {
        this.allScripts = await this.api.getAllScriptsByUser(this.userId);
        this.messageRenderer = new MessageRenderer(this.elements.messagesContainer);
        this.checkCurrentScriptId();
    }

    initializeElements() {
        this.elements.messagesContainer = document.querySelector(UI_ELEMENTS.MESSAGES_CONTAINER);
    }

    clearCurrentScript() {
        localStorage.removeItem('currentScript');
        localStorage.removeItem('currentScriptId');
        this.currentScript = null;
        this.currentScriptId = null;
    }

    checkCurrentScriptId() {
        this.currentScriptId = localStorage.getItem('currentScriptId');
    }

    setCurrentScript(currentScriptId) {
        this.currentScript = this.allScripts.find(script => script.id === currentScriptId);
        localStorage.setItem('currentScriptId', currentScriptId);
        alert("Script set to " + this.currentScript.title);
    }

    loadCurrentScript() {
        console.log('currentScriptCheck: ');
        console.log(this.currentScriptId);
        console.log(this.allScripts);
        console.log('********************');
        if (this.currentScriptId) {
            this.currentScript = this.allScripts.find(script => script.id === parseInt(this.currentScriptId));
            console.log(this.currentScript);
            this.messageRenderer.render("The current script is " + this.currentScript.title, MESSAGE_TYPES.ASSISTANT);
        } else if (this.allScripts && this.allScripts.length > 0) {

            this.messageRenderer.render("What script should we work on?", MESSAGE_TYPES.ASSISTANT);

            // Create buttons with proper event handlers
            const buttons = this.allScripts.map((script) => {
                const button = document.createElement('button');
                button.textContent = script.title;
                button.addEventListener('click', () => this.setCurrentScript(script.id));
                return button;
            });

            //add buttons to the messageRenderer
            this.messageRenderer.renderButtons(buttons);

        }
    }
}