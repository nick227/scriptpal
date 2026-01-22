import { ERROR_MESSAGES, UI_ELEMENTS } from '../constants.js';

const DEFAULT_ELEMENT_SELECTORS = Object.freeze({
    messagesContainer: UI_ELEMENTS.MESSAGES_CONTAINER,
    userInfo: UI_ELEMENTS.USER_INFO,
    loginForm: UI_ELEMENTS.LOGIN_FORM,
    registerForm: UI_ELEMENTS.REGISTER_FORM,
    logoutButton: UI_ELEMENTS.LOGOUT_BUTTON,
    toggleView: UI_ELEMENTS.TOGGLE_VIEW,
    siteControls: UI_ELEMENTS.SITE_CONTROLS,
    editorContainer: UI_ELEMENTS.EDITOR_CONTAINER,
    editorToolbar: UI_ELEMENTS.EDITOR_TOOLBAR,
    editorArea: UI_ELEMENTS.EDITOR_AREA,
    minimapContainer: UI_ELEMENTS.MINIMAP_CONTAINER,
    chatPanel: UI_ELEMENTS.CHAT_PANEL
});

const REQUIRED_ELEMENT_KEYS = new Set([
    'userInfo',
    'loginForm',
    'registerForm',
    'logoutButton',
    'toggleView',
    'siteControls',
    'editorContainer',
    'editorToolbar',
    'editorArea',
    'minimapContainer'
]);

export class ElementManager {
    constructor (selectors = DEFAULT_ELEMENT_SELECTORS) {
        this.selectors = selectors;
        this.elements = {};
    }

    initialize () {
        const { elements, missing } = this.resolveElements();
        const requiredMissing = missing.filter((item) => REQUIRED_ELEMENT_KEYS.has(item.key));
        if (requiredMissing.length) {
            const details = requiredMissing.map((item) => `${item.key} (${item.selector})`).join(', ');
            throw new Error(`${ERROR_MESSAGES.REQUIRED_ELEMENTS_MISSING}: ${details}`);
        }

        this.elements = elements;
        return this.elements;
    }

    getElements () {
        return this.elements;
    }

    isInitialized () {
        return Object.keys(this.elements).length > 0;
    }

    collectMissingElements () {
        return this.resolveElements().missing;
    }

    resolveElements () {
        return Object.entries(this.selectors).reduce((acc, [key, selector]) => {
            const element = document.querySelector(selector);
            acc.elements[key] = element;
            if (!element) {
                acc.missing.push({ key, selector });
            }
            return acc;
        }, { elements: {}, missing: [] });
    }
}
