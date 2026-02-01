import { EDITOR_EVENTS } from './constants.js';
import { KeyboardManager } from './keyboard/KeyboardManager.js';

/**
 * Routes DOM input, keyboard, and mouse events.
 */
export class EditorInputController {
    constructor (options = {}) {
        this.stateManager = options.stateManager;
        this.pageManager = options.pageManager;
        this.lineFormatter = options.lineFormatter;
        this.domHandler = options.domHandler;
        this.contentManager = options.contentManager;
        this.autocomplete = options.autocomplete || null;
        this.saveService = options.saveService || null;
        this.history = options.history || null;

        this.keyboardManager = new KeyboardManager({
            stateManager: this.stateManager,
            pageManager: this.pageManager,
            contentManager: this.contentManager,
            lineFormatter: this.lineFormatter,
            autocomplete: this.autocomplete,
            saveService: this.saveService,
            history: this.history
        });

        this._handlers = {
            cursorMove: (position) => {
                if (this.callbacks?.onCursorMove) {
                    this.callbacks.onCursorMove(position);
                }
            },
            formatChange: (payload) => {
                if (this.callbacks?.onFormatChange) {
                    this.callbacks.onFormatChange(payload);
                }
            },
            focusOut: (event) => {
                if (this.callbacks?.onFocusOut) {
                    this.callbacks.onFocusOut(event);
                }
            },
            focusIn: (event) => {
                if (this.callbacks?.onFocusIn) {
                    this.callbacks.onFocusIn(event);
                }
            },
            input: (event) => {
                if (this.callbacks?.onInput) {
                    this.callbacks.onInput(event);
                }
            }
        };
        this.callbacks = options.callbacks || {};
    }

    initialize (editorArea) {
        if (!editorArea) {
            console.error('[EditorInputController] No editor area provided');
            return;
        }
        this.editorArea = editorArea;

        if (this.keyboardManager) {
            this.keyboardManager.initialize(editorArea);
        }

        if (this.domHandler) {
            this.domHandler.on(EDITOR_EVENTS.CURSOR_MOVE, this._handlers.cursorMove);
            this.domHandler.on(EDITOR_EVENTS.FORMAT_CHANGE, this._handlers.formatChange);
        }

        this.editorArea.addEventListener('focusout', this._handlers.focusOut);
        this.editorArea.addEventListener('focusin', this._handlers.focusIn);
        this.editorArea.addEventListener('input', this._handlers.input);
    }

    setCallbacks (callbacks = {}) {
        this.callbacks = callbacks;
    }

    setContentManager (contentManager) {
        this.contentManager = contentManager;
        if (this.keyboardManager) {
            this.keyboardManager.contentManager = contentManager;
        }
    }

    setAutocomplete (autocomplete) {
        this.autocomplete = autocomplete;
        if (this.keyboardManager) {
            this.keyboardManager.autocomplete = autocomplete;
        }
    }

    setSaveService (saveService) {
        this.saveService = saveService;
        if (this.keyboardManager) {
            this.keyboardManager.saveService = saveService;
        }
    }

    setHistory (history) {
        this.history = history;
        if (this.keyboardManager) {
            this.keyboardManager.history = history;
        }
    }

    destroy () {
        if (this.domHandler) {
            this.domHandler.off(EDITOR_EVENTS.CURSOR_MOVE, this._handlers.cursorMove);
            this.domHandler.off(EDITOR_EVENTS.FORMAT_CHANGE, this._handlers.formatChange);
        }

        if (this.editorArea) {
            this.editorArea.removeEventListener('focusout', this._handlers.focusOut);
            this.editorArea.removeEventListener('focusin', this._handlers.focusIn);
            this.editorArea.removeEventListener('input', this._handlers.input);
        }

        if (this.keyboardManager) {
            this.keyboardManager.destroy();
        }

        this.editorArea = null;
        this.callbacks = null;
        this.contentManager = null;
    }
}
