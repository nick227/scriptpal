import { MESSAGE_TYPES } from './constants.js';

export class BaseRenderer {
    constructor(container) {
        this.container = container;
    }

    clear() {
        this.container.innerHTML = '';
    }

    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }

    scrollToTop() {
        this.sleep(1000).then(() => {
            this.container.scrollTop = 0;
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    createElement(tag, className, content = '') {
        const element = document.createElement(tag);
        element.className = className;
        if (content) {
            element.textContent = content;
        }
        return element;
    }

    appendElement(element) {
        this.container.appendChild(element);
    }

    prependElement(element) {
        this.container.insertBefore(element, this.container.firstChild);
    }

    createContainer(className) {
        return this.createElement('div', className);
    }

    toggleClass(element, className, condition) {
        if (condition) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }
}

export class MessageRenderer extends BaseRenderer {
    constructor(container, chat) {
        super(container);
        this.chat = chat;
        this.buttonRenderer = new ButtonContainerRenderer(container);
    }

    render(content, type = MESSAGE_TYPES.USER) {
        const messageDiv = this.createElement('div', `message ${type}`);
        messageDiv.innerHTML = content;
        this.prependElement(messageDiv);
        this.scrollToTop();
    }

    renderButtons(buttons) {
        this.buttonRenderer.render(buttons, (text) => {
            if (this.chat) {
                this.chat.handleButtonClick(text);
            }
        });
    }
}

export class ScriptRenderer extends BaseRenderer {
    constructor(container, onScriptSelect) {
        super(container);
        this.onScriptSelect = onScriptSelect;
    }

    render(scripts, currentScriptId) {
        this.clear();

        scripts.forEach(script => {
            const scriptElement = this.createContainer('script-item');
            this.toggleClass(scriptElement, 'active', script.id === currentScriptId);

            const titleElement = this.createElement('h3', '', script.title);
            scriptElement.appendChild(titleElement);

            const descriptionElement = this.createElement('p', '', script.description || 'No description');
            scriptElement.appendChild(descriptionElement);

            scriptElement.addEventListener('click', () => this.onScriptSelect(script.id));
            this.appendElement(scriptElement);
        });
    }
}

export class ButtonElementRenderer extends BaseRenderer {
    render(button, onClick) {
        if (!button || !button.text) return null;

        const buttonElement = this.createElement('button', 'action-button', button.text);
        if (onClick) {
            buttonElement.addEventListener('click', () => onClick(button.text));
        }
        return buttonElement;
    }
}

export class ButtonContainerRenderer extends BaseRenderer {
    constructor(container) {
        super(container);
        this.buttonRenderer = new ButtonElementRenderer(container);
    }

    render(buttons, onClick) {
        if (!Array.isArray(buttons) || buttons.length === 0) return;

        const buttonContainer = this.createContainer('button-container');

        buttons.forEach(button => {
            const buttonElement = this.buttonRenderer.render(button, onClick);
            if (buttonElement) {
                buttonContainer.insertBefore(buttonElement, buttonContainer.firstChild);
            }
        });

        this.prependElement(buttonContainer);
    }
}

export class RendererFactory {
    static createMessageRenderer(container, chat) {
        return new MessageRenderer(container, chat);
    }

    static createScriptRenderer(container, onScriptSelect) {
        return new ScriptRenderer(container, onScriptSelect);
    }

    static createButtonContainerRenderer(container) {
        return new ButtonContainerRenderer(container);
    }
}