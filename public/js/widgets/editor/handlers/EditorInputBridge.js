import { EDITOR_EVENTS } from '../constants.js';

/**
 * Lightweight bridge from DOM events to editor events.
 * No logic, no interpretation - just event forwarding.
 */
export class EditorInputBridge {
    /**
     * @param {HTMLElement} container - Editor container element
     * @param {EditorCaretManager} caretManager - For cursor position
     * @param {function} emit - Event emitter function
     */
    constructor (container, caretManager, emit) {
        this.container = container;
        this.caretManager = caretManager;
        this.emit = emit;

        this._eventsBound = false;
        this._boundHandlers = {};
    }

    /**
     * Set up DOM event listeners.
     */
    setup () {
        if (this._eventsBound) {
            return;
        }
        this._eventsBound = true;

        this._boundHandlers.click = this._handleClick.bind(this);
        this._boundHandlers.keyup = this._handleKeyup.bind(this);

        this.container.addEventListener('click', this._boundHandlers.click);
        this.container.addEventListener('keyup', this._boundHandlers.keyup);
    }

    /**
     * Remove DOM event listeners.
     */
    teardown () {
        if (!this._eventsBound) {
            return;
        }

        this.container.removeEventListener('click', this._boundHandlers.click);
        this.container.removeEventListener('keyup', this._boundHandlers.keyup);

        this._eventsBound = false;
        this._boundHandlers = {};
    }

    /**
     * @param {MouseEvent} event
     */
    _handleClick (event) {
        const line = event.target.closest('.script-line');
        if (!line) {
            return;
        }

        const cursorPos = this.caretManager.getCursorPosition(line);
        if (cursorPos.position) {
            this.emit(EDITOR_EVENTS.CURSOR_MOVE, cursorPos);
        }
    }

    /**
     * @param {KeyboardEvent} event
     */
    _handleKeyup (event) {
        const line = event.target.closest('.script-line');
        if (!line) {
            return;
        }

        const cursorPos = this.caretManager.getCursorPosition(line);
        if (cursorPos.position) {
            this.emit(EDITOR_EVENTS.CURSOR_MOVE, cursorPos);
        }
    }
}
