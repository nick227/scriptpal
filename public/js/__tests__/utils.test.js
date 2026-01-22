import { utils } from '../utils.js';

describe('utils', () => {
    describe('debounce', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should delay function execution', () => {
            const mockFn = jest.fn();
            const debouncedFn = utils.debounce(mockFn, 100);

            debouncedFn();
            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should reset delay on subsequent calls', () => {
            const mockFn = jest.fn();
            const debouncedFn = utils.debounce(mockFn, 100);

            debouncedFn();
            jest.advanceTimersByTime(50);
            debouncedFn();
            jest.advanceTimersByTime(50);
            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to debounced function', () => {
            const mockFn = jest.fn();
            const debouncedFn = utils.debounce(mockFn, 100);

            debouncedFn('arg1', 'arg2');
            jest.advanceTimersByTime(100);

            expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
        });
    });

    describe('throttle', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should limit function execution frequency', () => {
            const mockFn = jest.fn();
            const throttledFn = utils.throttle(mockFn, 100);

            throttledFn();
            throttledFn();
            throttledFn();

            expect(mockFn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);
            throttledFn();
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        it('should pass arguments to throttled function', () => {
            const mockFn = jest.fn();
            const throttledFn = utils.throttle(mockFn, 100);

            throttledFn('arg1', 'arg2');
            jest.advanceTimersByTime(100);
            throttledFn('arg3', 'arg4');

            expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
            expect(mockFn).toHaveBeenCalledWith('arg3', 'arg4');
        });
    });

    describe('formatDate', () => {
        it('should format date correctly', () => {
            const date = new Date('2023-12-25T10:30:00Z');
            const formatted = utils.formatDate(date);

            expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        });

        it('should handle invalid date', () => {
            const formatted = utils.formatDate('invalid date');
            expect(formatted).toBe('Invalid Date');
        });

        it('should use current date when no date provided', () => {
            const formatted = utils.formatDate();
            expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        });
    });

    describe('formatTime', () => {
        it('should format time correctly', () => {
            const date = new Date('2023-12-25T14:30:00Z');
            const formatted = utils.formatTime(date);

            expect(formatted).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
        });

        it('should handle invalid date', () => {
            const formatted = utils.formatTime('invalid date');
            expect(formatted).toBe('Invalid Time');
        });

        it('should use current time when no date provided', () => {
            const formatted = utils.formatTime();
            expect(formatted).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
        });
    });

    describe('generateId', () => {
        it('should generate unique IDs', () => {
            const id1 = utils.generateId();
            const id2 = utils.generateId();

            expect(id1).toMatch(/^[a-z0-9-]+$/);
            expect(id2).toMatch(/^[a-z0-9-]+$/);
            expect(id1).not.toBe(id2);
        });

        it('should generate IDs with specified length', () => {
            const id = utils.generateId(10);
            expect(id).toHaveLength(10);
        });

        it('should use default length when not specified', () => {
            const id = utils.generateId();
            expect(id.length).toBeGreaterThan(0);
        });
    });

    describe('sanitizeHtml', () => {
        it('should remove script tags', () => {
            const html = '<p>Hello</p><script>alert("xss")</script><div>World</div>';
            const sanitized = utils.sanitizeHtml(html);

            expect(sanitized).toBe('<p>Hello</p><div>World</div>');
        });

        it('should remove dangerous attributes', () => {
            const html = '<div onclick="alert(\'xss\')" class="safe">Content</div>';
            const sanitized = utils.sanitizeHtml(html);

            expect(sanitized).not.toContain('onclick');
            expect(sanitized).toContain('class="safe"');
        });

        it('should preserve safe HTML', () => {
            const html = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
            const sanitized = utils.sanitizeHtml(html);

            expect(sanitized).toBe(html);
        });

        it('should handle empty string', () => {
            const sanitized = utils.sanitizeHtml('');
            expect(sanitized).toBe('');
        });

        it('should handle null/undefined', () => {
            expect(utils.sanitizeHtml(null)).toBe('');
            expect(utils.sanitizeHtml(undefined)).toBe('');
        });
    });

    describe('validateEmail', () => {
        it('should validate correct email addresses', () => {
            expect(utils.validateEmail('test@example.com')).toBe(true);
            expect(utils.validateEmail('user.name+tag@domain.co.uk')).toBe(true);
            expect(utils.validateEmail('user123@test-domain.org')).toBe(true);
        });

        it('should reject invalid email addresses', () => {
            expect(utils.validateEmail('invalid-email')).toBe(false);
            expect(utils.validateEmail('@example.com')).toBe(false);
            expect(utils.validateEmail('test@')).toBe(false);
            expect(utils.validateEmail('test..test@example.com')).toBe(false);
            expect(utils.validateEmail('')).toBe(false);
        });

        it('should handle null/undefined', () => {
            expect(utils.validateEmail(null)).toBe(false);
            expect(utils.validateEmail(undefined)).toBe(false);
        });
    });

    describe('capitalize', () => {
        it('should capitalize first letter', () => {
            expect(utils.capitalize('hello')).toBe('Hello');
            expect(utils.capitalize('world')).toBe('World');
        });

        it('should handle single character', () => {
            expect(utils.capitalize('a')).toBe('A');
        });

        it('should handle empty string', () => {
            expect(utils.capitalize('')).toBe('');
        });

        it('should handle already capitalized string', () => {
            expect(utils.capitalize('Hello')).toBe('Hello');
        });

        it('should handle null/undefined', () => {
            expect(utils.capitalize(null)).toBe('');
            expect(utils.capitalize(undefined)).toBe('');
        });
    });

    describe('truncate', () => {
        it('should truncate long strings', () => {
            const longString = 'This is a very long string that should be truncated';
            const truncated = utils.truncate(longString, 20);

            expect(truncated).toBe('This is a very lo...');
            expect(truncated.length).toBe(20);
        });

        it('should not truncate short strings', () => {
            const shortString = 'Short';
            const truncated = utils.truncate(shortString, 20);

            expect(truncated).toBe('Short');
        });

        it('should use default length when not specified', () => {
            const longString = 'This is a very long string that should be truncated';
            const truncated = utils.truncate(longString);

            expect(truncated.length).toBeLessThanOrEqual(50);
        });

        it('should handle null/undefined', () => {
            expect(utils.truncate(null)).toBe('');
            expect(utils.truncate(undefined)).toBe('');
        });
    });

    describe('deepClone', () => {
        it('should clone simple objects', () => {
            const original = { a: 1, b: 'test', c: true };
            const cloned = utils.deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
        });

        it('should clone nested objects', () => {
            const original = {
                a: 1,
                b: {
                    c: 2,
                    d: {
                        e: 3
                    }
                }
            };
            const cloned = utils.deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned.b).not.toBe(original.b);
            expect(cloned.b.d).not.toBe(original.b.d);
        });

        it('should clone arrays', () => {
            const original = [1, 2, { a: 3 }, [4, 5]];
            const cloned = utils.deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned[2]).not.toBe(original[2]);
            expect(cloned[3]).not.toBe(original[3]);
        });

        it('should handle primitive values', () => {
            expect(utils.deepClone(42)).toBe(42);
            expect(utils.deepClone('test')).toBe('test');
            expect(utils.deepClone(true)).toBe(true);
            expect(utils.deepClone(null)).toBe(null);
        });

        it('should handle null/undefined', () => {
            expect(utils.deepClone(null)).toBe(null);
            expect(utils.deepClone(undefined)).toBe(undefined);
        });
    });

    describe('isEmpty', () => {
        it('should detect empty objects', () => {
            expect(utils.isEmpty({})).toBe(true);
            expect(utils.isEmpty({ a: 1 })).toBe(false);
        });

        it('should detect empty arrays', () => {
            expect(utils.isEmpty([])).toBe(true);
            expect(utils.isEmpty([1, 2, 3])).toBe(false);
        });

        it('should detect empty strings', () => {
            expect(utils.isEmpty('')).toBe(true);
            expect(utils.isEmpty('test')).toBe(false);
        });

        it('should detect null/undefined', () => {
            expect(utils.isEmpty(null)).toBe(true);
            expect(utils.isEmpty(undefined)).toBe(true);
        });

        it('should handle non-empty values', () => {
            expect(utils.isEmpty(0)).toBe(false);
            expect(utils.isEmpty(false)).toBe(false);
            expect(utils.isEmpty(42)).toBe(false);
        });
    });
});
