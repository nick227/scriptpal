/**
 * Security Manager
 * Provides XSS sanitization and input validation
 */
export class SecurityManager {
    /**
     *
     * @param options
     */
    constructor (options = {}) {
        this.allowedTags = options.allowedTags || ['b', 'i', 'em', 'strong', 'br'];
        this.allowedAttributes = options.allowedAttributes || ['class', 'data-format'];
        this.maxInputLength = options.maxInputLength || 10000;
        this.sanitizeOnInput = options.sanitizeOnInput !== false;
        this.validationRules = new Map();
        this.suspiciousPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe[^>]*>.*?<\/iframe>/gi,
            /<object[^>]*>.*?<\/object>/gi,
            /<embed[^>]*>.*?<\/embed>/gi,
            /<link[^>]*>.*?<\/link>/gi,
            /<meta[^>]*>.*?<\/meta>/gi,
            /<style[^>]*>.*?<\/style>/gi
        ];
    }

    /**
     * Sanitize HTML content
     * @param {string} html - HTML content to sanitize
     * @returns {string} - Sanitized HTML
     */
    sanitizeHTML (html) {
        if (typeof html !== 'string') {
            return '';
        }

        // Remove suspicious patterns
        let sanitized = html;
        for (const pattern of this.suspiciousPatterns) {
            sanitized = sanitized.replace(pattern, '');
        }

        // Create temporary element for parsing
        const temp = document.createElement('div');
        temp.innerHTML = sanitized;

        // Remove disallowed tags and attributes
        this._sanitizeElement(temp);

        return temp.innerHTML;
    }

    /**
     * Sanitize DOM element recursively
     * @param {HTMLElement} element - Element to sanitize
     */
    _sanitizeElement (element) {
        const children = Array.from(element.children);

        for (const child of children) {
            // Remove disallowed tags
            if (!this.allowedTags.includes(child.tagName.toLowerCase())) {
                element.removeChild(child);
                continue;
            }

            // Remove disallowed attributes
            const attributes = Array.from(child.attributes);
            for (const attr of attributes) {
                if (!this.allowedAttributes.includes(attr.name)) {
                    child.removeAttribute(attr.name);
                }
            }

            // Recursively sanitize children
            this._sanitizeElement(child);
        }
    }

    /**
     * Sanitize text content
     * @param {string} text - Text to sanitize
     * @returns {string} - Sanitized text
     */
    sanitizeText (text) {
        if (typeof text !== 'string') {
            return '';
        }

        // Escape HTML entities
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Validate input length
     * @param {string} input - Input to validate
     * @returns {boolean} - Whether input is valid
     */
    validateLength (input) {
        if (typeof input !== 'string') {
            return false;
        }
        return input.length <= this.maxInputLength;
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} - Whether email is valid
     */
    validateEmail (email) {
        if (typeof email !== 'string') {
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
    }

    /**
     * Validate script content
     * @param {string} content - Script content to validate
     * @returns {object} - Validation result
     */
    validateScriptContent (content) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (typeof content !== 'string') {
            result.isValid = false;
            result.errors.push('Content must be a string');
            return result;
        }

        // Check length
        if (!this.validateLength(content)) {
            result.isValid = false;
            result.errors.push(`Content exceeds maximum length of ${this.maxInputLength} characters`);
        }

        // Check for suspicious patterns
        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(content)) {
                result.isValid = false;
                result.errors.push('Content contains potentially dangerous patterns');
                break;
            }
        }

        // Check for balanced tags
        if (!this._hasBalancedTags(content)) {
            result.warnings.push('Content has unbalanced HTML tags');
        }

        return result;
    }

    /**
     * Check if HTML tags are balanced
     * @param {string} html - HTML content
     * @returns {boolean} - Whether tags are balanced
     */
    _hasBalancedTags (html) {
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g;
        const stack = [];
        let match;

        while ((match = tagRegex.exec(html)) !== null) {
            const tag = match[1].toLowerCase();
            const isClosing = match[0].startsWith('</');

            if (isClosing) {
                if (stack.length === 0 || stack.pop() !== tag) {
                    return false;
                }
            } else {
                // Skip self-closing tags
                if (!match[0].endsWith('/>')) {
                    stack.push(tag);
                }
            }
        }

        return stack.length === 0;
    }

    /**
     * Add validation rule
     * @param {string} name - Rule name
     * @param {Function} validator - Validation function
     */
    addValidationRule (name, validator) {
        if (typeof validator !== 'function') {
            throw new Error('Validator must be a function');
        }
        this.validationRules.set(name, validator);
    }

    /**
     * Validate using custom rule
     * @param {string} ruleName - Rule name
     * @param {*} value - Value to validate
     * @returns {boolean} - Whether value is valid
     */
    validateWithRule (ruleName, value) {
        const validator = this.validationRules.get(ruleName);
        if (!validator) {
            throw new Error(`Validation rule '${ruleName}' not found`);
        }
        return validator(value);
    }

    /**
     * Sanitize and validate input
     * @param {string} input - Input to process
     * @param {object} options - Processing options
     * @returns {object} - Processing result
     */
    processInput (input, options = {}) {
        const result = {
            original: input,
            sanitized: '',
            isValid: true,
            errors: [],
            warnings: []
        };

        if (typeof input !== 'string') {
            result.isValid = false;
            result.errors.push('Input must be a string');
            return result;
        }

        // Sanitize based on type
        if (options.type === 'html') {
            result.sanitized = this.sanitizeHTML(input);
        } else {
            result.sanitized = this.sanitizeText(input);
        }

        // Validate length
        if (!this.validateLength(result.sanitized)) {
            result.isValid = false;
            result.errors.push(`Input exceeds maximum length of ${this.maxInputLength} characters`);
        }

        // Custom validation
        if (options.validation) {
            for (const rule of options.validation) {
                try {
                    if (!this.validateWithRule(rule, result.sanitized)) {
                        result.isValid = false;
                        result.errors.push(`Validation failed for rule: ${rule}`);
                    }
                } catch (error) {
                    result.warnings.push(`Validation rule '${rule}' failed: ${error.message}`);
                }
            }
        }

        return result;
    }

    /**
     * Create secure text node
     * @param {string} text - Text content
     * @returns {Text} - Secure text node
     */
    createSecureTextNode (text) {
        const sanitized = this.sanitizeText(text);
        return document.createTextNode(sanitized);
    }

    /**
     * Create secure element
     * @param {string} tagName - Tag name
     * @param {object} attributes - Element attributes
     * @param {string} content - Element content
     * @returns {HTMLElement} - Secure element
     */
    createSecureElement (tagName, attributes = {}, content = '') {
        const element = document.createElement(tagName);

        // Set attributes safely
        for (const [key, value] of Object.entries(attributes)) {
            if (this.allowedAttributes.includes(key)) {
                element.setAttribute(key, this.sanitizeText(value));
            }
        }

        // Set content safely
        if (content) {
            if (this.allowedTags.includes(tagName.toLowerCase())) {
                element.innerHTML = this.sanitizeHTML(content);
            } else {
                element.textContent = content;
            }
        }

        return element;
    }

    /**
     * Set up input sanitization for element
     * @param {HTMLElement} element - Element to set up
     * @param {object} options - Sanitization options
     */
    setupInputSanitization (element, options = {}) {
        if (!element || !(element instanceof HTMLElement)) {
            return;
        }

        const sanitize = (event) => {
            const input = event.target;
            const originalValue = input.value;
            const processed = this.processInput(originalValue, options);

            if (!processed.isValid) {
                console.warn('Input validation failed:', processed.errors);
                // Optionally revert to last valid value
                if (options.revertOnInvalid) {
                    input.value = input.dataset.lastValidValue || '';
                }
            } else {
                input.value = processed.sanitized;
                input.dataset.lastValidValue = processed.sanitized;
            }
        };

        element.addEventListener('input', sanitize);
        element.addEventListener('paste', sanitize);
    }

    /**
     * Get security statistics
     * @returns {object} - Security statistics
     */
    getSecurityStats () {
        return {
            allowedTags: this.allowedTags.length,
            allowedAttributes: this.allowedAttributes.length,
            suspiciousPatterns: this.suspiciousPatterns.length,
            validationRules: this.validationRules.size,
            maxInputLength: this.maxInputLength
        };
    }

    /**
     * Update security configuration
     * @param {object} config - New configuration
     */
    updateConfig (config) {
        if (config.allowedTags) {
            this.allowedTags = config.allowedTags;
        }
        if (config.allowedAttributes) {
            this.allowedAttributes = config.allowedAttributes;
        }
        if (config.maxInputLength) {
            this.maxInputLength = config.maxInputLength;
        }
        if (config.sanitizeOnInput !== undefined) {
            this.sanitizeOnInput = config.sanitizeOnInput;
        }
    }
}

/**
 * Security Manager Factory
 */
export class SecurityManagerFactory {
    /**
     * Create security manager
     * @param {object} options - Manager options
     * @returns {SecurityManager} - New manager instance
     */
    static create (options = {}) {
        return new SecurityManager(options);
    }

    /**
     * Create strict security manager
     * @returns {SecurityManager} - Strict security manager
     */
    static createStrict () {
        return new SecurityManager({
            allowedTags: ['br'],
            allowedAttributes: ['class'],
            maxInputLength: 5000,
            sanitizeOnInput: true
        });
    }

    /**
     * Create permissive security manager
     * @returns {SecurityManager} - Permissive security manager
     */
    static createPermissive () {
        return new SecurityManager({
            allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
            allowedAttributes: ['class', 'data-format', 'id'],
            maxInputLength: 50000,
            sanitizeOnInput: false
        });
    }
}
