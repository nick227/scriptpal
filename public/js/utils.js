import { API_HEADERS, ERROR_MESSAGES } from './constants.js';

export const utils = {
    async fetchAPI (url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...API_HEADERS,
                    ...options.headers
                },
                mode: 'cors',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                console.error('CORS Error: Make sure the server allows requests from this origin');
            }
            return null;
        }
    },

    debounce (func, wait) {
        let timeout;
        return function executedFunction (...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle (func, limit) {
        let inThrottle;
        return function executedFunction (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    formatDate (date = new Date()) {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) {
                return 'Invalid Date';
            }
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const year = d.getFullYear();
            return `${month}/${day}/${year}`;
        } catch (error) {
            return 'Invalid Date';
        }
    },

    formatTime (date = new Date()) {
        try {
            return new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(new Date(date));
        } catch (error) {
            return 'Invalid Time';
        }
    },

    generateId (length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    sanitizeHtml (html) {
        if (!html || typeof html !== 'string') return '';

        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove script tags
        const scripts = temp.querySelectorAll('script');
        scripts.forEach(script => script.remove());

        // Remove dangerous attributes
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(element => {
            // Remove event handlers and dangerous attributes
            const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
            dangerousAttrs.forEach(attr => {
                if (element.hasAttribute(attr)) {
                    element.removeAttribute(attr);
                }
            });
        });

        return temp.innerHTML;
    },

    validateEmail (email) {
        if (!email || typeof email !== 'string') return false;
        // More comprehensive email validation
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        // Additional checks
        if (email.startsWith('.') || email.endsWith('.')) return false;
        if (email.includes('..')) return false;
        if (email.startsWith('@') || email.endsWith('@')) return false;

        return emailRegex.test(email);
    },

    capitalize (str) {
        if (!str || typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    truncate (str, length = 50) {
        if (!str || typeof str !== 'string') return '';
        if (str.length <= length) return str;
        return str.substring(0, length - 3) + '...';
    },

    deepClone (obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => utils.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = utils.deepClone(obj[key]);
            });
            return cloned;
        }
        return obj;
    },

    isEmpty (value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }
};
