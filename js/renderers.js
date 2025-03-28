import { ERROR_MESSAGES, MESSAGE_TYPES } from './constants.js';

export class BaseRenderer {
    constructor(container = null) {
        this.container = container;
    }

    createElement(tag, className = '', content = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) element.textContent = content;
        return element;
    }

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    scrollToBottom() {
        console.log('BaseRenderer: Scrolling to bottom');
        this.container.scrollTop = this.container.scrollHeight;
    }

    appendElement(element) {
        if (!element) {
            console.log('BaseRenderer: No element to append');
            return;
        }
        console.log('BaseRenderer: Appending element:', element);
        this.container.appendChild(element);
        this.scrollToBottom();
    }
}

export class UserRenderer extends BaseRenderer {
    constructor(container, user) {
        super(container);
        this.user = user;
    }

    updateUserInfo(user) {
        if (!this.container) return;

        if (user) {
            this.container.textContent = `Welcome, ${user.name || user.email}`;
        } else {
            this.container.textContent = 'Please log in';
        }
    }
}

export class MessageRenderer extends BaseRenderer {
    constructor(container) {
        super(container);
    }

    render(content, type = MESSAGE_TYPES.USER) {
        if (!this.container) {
            console.error('Message container not found');
            return;
        }

        const messageElement = this.createElement('div', `message ${type}`);
        messageElement.innerHTML = content;
        this.container.appendChild(messageElement);
        this.container.scrollTop = this.container.scrollHeight;
    }

    renderButtons(buttons) {
        if (!this.container) {
            console.error('Message container not found');
            return;
        }

        const buttonContainer = this.createElement('div', 'assistant-buttons');
        if (typeof buttons === 'string') {
            buttonContainer.innerHTML = buttons;
        } else {
            buttons.forEach(text => {
                const buttonElement = this.createElement('button', 'dynamic-button');
                buttonElement.textContent = text;
                buttonContainer.appendChild(buttonElement);
            });
        }
        this.container.appendChild(buttonContainer);
        this.container.scrollTop = this.container.scrollHeight;
    }
}

export class AssistantResponseRenderer extends BaseRenderer {
    constructor() {
        super();
    }

    render(response) {
        if (!response) return null;

        const container = this.createElement('div', 'assistant-response');

        if (response.html) {
            container.innerHTML = response.html;
        }

        if (response.buttons && Array.isArray(response.buttons)) {
            const buttonContainer = this.createElement('div', 'assistant-buttons');
            response.buttons.forEach(button => {
                const buttonElement = this.createElement('button', 'dynamic-button');
                buttonElement.textContent = button.text;
                buttonElement.addEventListener('click', () => button.action());
                buttonContainer.appendChild(buttonElement);
            });
            container.appendChild(buttonContainer);
        }

        return container;
    }
}