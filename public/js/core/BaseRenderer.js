/**
 * Base class for all renderers with common DOM manipulation utilities
 */
export class BaseRenderer {
    constructor(container) {
        this.container = container;
    }

    // DOM Manipulation
    createElement(tag, className, content = '') {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (content) {
            element.textContent = content;
        }
        return element;
    }

    createContainer(className) {
        return this.createElement('div', className);
    }

    // Container Operations
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    appendElement(element) {
        if (this.container && element) {
            this.container.appendChild(element);
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        if (this.container) {
            this.container.scrollTop = this.container.scrollHeight;
        }
    }

    scrollToTop() {
        if (this.container) {
            this.container.scrollTop = 0;
        }
    }

    prependElement(element) {
        if (!element || !this.container) return;
        this.container.insertBefore(element, this.container.firstChild);
        this.scrollToTop();
    }

    setContainer(container) {
        this.container = container;
    }

    // Helper methods for common operations
    setAttributes(element, attributes) {
        if (!element || !attributes) return;
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    setContent(element, content) {
        if (!element) return;
        element.textContent = content;
    }

    addClasses(element, classes) {
        if (!element || !classes) return;
        if (Array.isArray(classes)) {
            element.classList.add(...classes);
        } else {
            element.classList.add(classes);
        }
    }

    removeClasses(element, classes) {
        if (!element || !classes) return;
        if (Array.isArray(classes)) {
            element.classList.remove(...classes);
        } else {
            element.classList.remove(classes);
        }
    }

    // Utility Methods
    toggleClass(element, className, condition) {
        if (!element) return;
        if (condition) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }

    // Event Handling
    addEventListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    removeEventListener(element, event, handler) {
        if (element) {
            element.removeEventListener(event, handler);
        }
    }
}