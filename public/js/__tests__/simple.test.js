/**
 * Simple test to verify Jest setup is working
 */

describe('Jest Setup', () => {
    it('should run basic tests', () => {
        expect(1 + 1).toBe(2);
    });

    it('should have DOM available', () => {
        expect(document).toBeDefined();
        expect(window).toBeDefined();
    });

    it('should have fetch mocked', () => {
        expect(global.fetch).toBeDefined();
        expect(typeof global.fetch).toBe('function');
    });

    it('should have localStorage mocked', () => {
        expect(global.localStorage).toBeDefined();
        const storage = global.localStorage;
        expect(typeof storage.setItem).toBe('function');
    });

    it('should handle async operations', async () => {
        const promise = Promise.resolve('test');
        const result = await promise;
        expect(result).toBe('test');
    });
});
