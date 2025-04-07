/**
 * Utility class for common DOM operations
 */
export class DOMUtils {
    static createElement(tag, className = '', content = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) element.textContent = content;
        return element;
    }

    static setAttributes(element, attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    static addClasses(element, classes) {
        classes.forEach(className => element.classList.add(className));
    }

    static removeClasses(element, classes) {
        classes.forEach(className => element.classList.remove(className));
    }

    static setContent(element, content) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else {
            element.innerHTML = content;
        }
    }

    static clearElement(element) {
        if (element) {
            element.innerHTML = '';
        }
    }

    static scrollToBottom(element) {
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }

    static scrollToTop(element) {
        if (element) {
            element.scrollTop = 0;
        }
    }
}