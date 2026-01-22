/**
 * Base class for all renderers with common DOM manipulation utilities
 */
export class BaseRenderer {
    /**
     *
     * @param container
     */
    constructor (container) {
        this.container = container;
    }

    // DOM Manipulation
    /**
     *
     * @param tag
     * @param className
     * @param content
     */
    createElement (tag, className, content = '') {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (content) {
            element.textContent = content;
        }
        return element;
    }

    /**
     *
     * @param className
     */
    createContainer (className) {
        return this.createElement('div', className);
    }

    // Container Operations
    /**
     *
     */
    clear () {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     *
     * @param element
     */
    appendElement (element) {
        if (this.container && element) {
            this.container.appendChild(element);
            this.scrollToTop();
        }
    }

    /**
     *
     */
    scrollToBottom () {
        if (this.container) {
            this.container.scrollTop = this.container.scrollHeight;
        }
    }

    /**
     *
     */
    scrollToTop () {
        if (this.container) {
            this.container.scrollTop = 0;
        }
    }

    /**
     *
     * @param element
     */
    prependElement (element) {
        if (!element || !this.container) return;
        this.container.insertBefore(element, this.container.firstChild);
        this.scrollToTop();
    }

    /**
     *
     * @param container
     */
    setContainer (container) {
        this.container = container;
    }

    // Helper methods for common operations
    /**
     *
     * @param element
     * @param attributes
     */
    setAttributes (element, attributes) {
        if (!element || !attributes) return;
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    /**
     *
     * @param element
     * @param content
     */
    setContent (element, content) {
        if (!element) return;
        element.textContent = content;
    }

    /**
     *
     * @param element
     * @param classes
     */
    addClasses (element, classes) {
        if (!element || !classes) return;
        if (Array.isArray(classes)) {
            element.classList.add(...classes);
        } else {
            element.classList.add(classes);
        }
    }

    /**
     *
     * @param element
     * @param classes
     */
    removeClasses (element, classes) {
        if (!element || !classes) return;
        if (Array.isArray(classes)) {
            element.classList.remove(...classes);
        } else {
            element.classList.remove(classes);
        }
    }

    // Utility Methods
    /**
     *
     * @param element
     * @param className
     * @param condition
     */
    toggleClass (element, className, condition) {
        if (!element) return;
        if (condition) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }

    // Event Handling
    /**
     *
     * @param element
     * @param event
     * @param handler
     */
    addEventListener (element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    /**
     *
     * @param element
     * @param event
     * @param handler
     */
    removeEventListener (element, event, handler) {
        if (element) {
            element.removeEventListener(event, handler);
        }
    }
}
