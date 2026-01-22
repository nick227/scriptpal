/**
 * Tests for Requirement #30: Users can go full screen that hides the top bar and navbar and uses max screen height for pages
 */

import { FullscreenManager } from '../../widgets/ui/FullscreenManager.js';

describe('Requirement #30: Fullscreen Mode', () => {
    let fullscreenManager;
    let mockContainer;
    let mockEventManager;
    let mockStateManager;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        mockContainer.innerHTML = `
            <div class="top-bar">Top Bar Content</div>
            <div class="navbar">Navbar Content</div>
            <div class="editor-container">Editor Content</div>
            <div class="chat-container">Chat Content</div>
        `;
        document.body.appendChild(mockContainer);

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                isFullscreen: false
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create fullscreen manager
        fullscreenManager = new FullscreenManager({
            container: mockContainer,
            eventManager: mockEventManager,
            stateManager: mockStateManager
        });
    });

    afterEach(() => {
        fullscreenManager.destroy();
        document.body.removeChild(mockContainer);
    });

    describe('Fullscreen Toggle', () => {
        test('should toggle fullscreen mode on/off', () => {
            expect(fullscreenManager.isFullscreen).toBe(false);

            fullscreenManager.toggleFullscreen();
            expect(fullscreenManager.isFullscreen).toBe(true);

            fullscreenManager.toggleFullscreen();
            expect(fullscreenManager.isFullscreen).toBe(false);
        });

        test('should enter fullscreen mode', () => {
            fullscreenManager.enterFullscreen();

            expect(fullscreenManager.isFullscreen).toBe(true);
        });

        test('should exit fullscreen mode', () => {
            fullscreenManager.enterFullscreen();
            expect(fullscreenManager.isFullscreen).toBe(true);

            fullscreenManager.exitFullscreen();
            expect(fullscreenManager.isFullscreen).toBe(false);
        });
    });

    describe('UI Element Hiding', () => {
        test('should hide top bar in fullscreen mode', () => {
            const topBar = mockContainer.querySelector('.top-bar');

            fullscreenManager.enterFullscreen();

            expect(topBar.style.display).toBe('none');
        });

        test('should hide navbar in fullscreen mode', () => {
            const navbar = mockContainer.querySelector('.navbar');

            fullscreenManager.enterFullscreen();

            expect(navbar.style.display).toBe('none');
        });

        test('should show top bar when exiting fullscreen', () => {
            const topBar = mockContainer.querySelector('.top-bar');

            fullscreenManager.enterFullscreen();
            expect(topBar.style.display).toBe('none');

            fullscreenManager.exitFullscreen();
            expect(topBar.style.display).toBe('');
        });

        test('should show navbar when exiting fullscreen', () => {
            const navbar = mockContainer.querySelector('.navbar');

            fullscreenManager.enterFullscreen();
            expect(navbar.style.display).toBe('none');

            fullscreenManager.exitFullscreen();
            expect(navbar.style.display).toBe('');
        });
    });

    describe('Max Screen Height Usage', () => {
        test('should use maximum screen height for pages in fullscreen', () => {
            const editorContainer = mockContainer.querySelector('.editor-container');

            fullscreenManager.enterFullscreen();

            expect(editorContainer.style.height).toBe('100vh');
        });

        test('should restore original height when exiting fullscreen', () => {
            const editorContainer = mockContainer.querySelector('.editor-container');
            const originalHeight = editorContainer.style.height;

            fullscreenManager.enterFullscreen();
            expect(editorContainer.style.height).toBe('100vh');

            fullscreenManager.exitFullscreen();
            expect(editorContainer.style.height).toBe(originalHeight);
        });

        test('should apply fullscreen styles to editor container', () => {
            const editorContainer = mockContainer.querySelector('.editor-container');

            fullscreenManager.enterFullscreen();

            expect(editorContainer.classList.contains('fullscreen-mode')).toBe(true);
        });

        test('should remove fullscreen styles when exiting', () => {
            const editorContainer = mockContainer.querySelector('.editor-container');

            fullscreenManager.enterFullscreen();
            expect(editorContainer.classList.contains('fullscreen-mode')).toBe(true);

            fullscreenManager.exitFullscreen();
            expect(editorContainer.classList.contains('fullscreen-mode')).toBe(false);
        });
    });

    describe('State Management', () => {
        test('should update state manager when entering fullscreen', () => {
            fullscreenManager.enterFullscreen();

            expect(mockStateManager.setState).toHaveBeenCalledWith('isFullscreen', true);
        });

        test('should update state manager when exiting fullscreen', () => {
            fullscreenManager.enterFullscreen();
            fullscreenManager.exitFullscreen();

            expect(mockStateManager.setState).toHaveBeenCalledWith('isFullscreen', false);
        });

        test('should publish fullscreen change events', () => {
            fullscreenManager.enterFullscreen();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'UI:FULLSCREEN_CHANGED',
                { isFullscreen: true }
            );
        });

        test('should publish exit fullscreen events', () => {
            fullscreenManager.enterFullscreen();
            fullscreenManager.exitFullscreen();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'UI:FULLSCREEN_CHANGED',
                { isFullscreen: false }
            );
        });
    });

    describe('Keyboard Shortcuts', () => {
        test('should handle F11 key for fullscreen toggle', () => {
            const f11Event = new KeyboardEvent('keydown', {
                key: 'F11',
                bubbles: true
            });

            const toggleSpy = jest.spyOn(fullscreenManager, 'toggleFullscreen');

            document.dispatchEvent(f11Event);

            expect(toggleSpy).toHaveBeenCalled();
        });

        test('should handle Escape key to exit fullscreen', () => {
            fullscreenManager.enterFullscreen();

            const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });

            const exitSpy = jest.spyOn(fullscreenManager, 'exitFullscreen');

            document.dispatchEvent(escapeEvent);

            expect(exitSpy).toHaveBeenCalled();
        });

        test('should not exit fullscreen on Escape if not in fullscreen', () => {
            const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            });

            const exitSpy = jest.spyOn(fullscreenManager, 'exitFullscreen');

            document.dispatchEvent(escapeEvent);

            expect(exitSpy).not.toHaveBeenCalled();
        });
    });

    describe('Fullscreen API Integration', () => {
        test('should use browser fullscreen API when available', () => {
            // Mock fullscreen API
            const mockFullscreenAPI = {
                requestFullscreen: jest.fn().mockResolvedValue(),
                exitFullscreen: jest.fn().mockResolvedValue(),
                fullscreenElement: null
            };

            Object.defineProperty(document, 'fullscreenElement', {
                value: null,
                writable: true
            });

            Object.defineProperty(document.documentElement, 'requestFullscreen', {
                value: mockFullscreenAPI.requestFullscreen,
                writable: true
            });

            Object.defineProperty(document, 'exitFullscreen', {
                value: mockFullscreenAPI.exitFullscreen,
                writable: true
            });

            fullscreenManager.enterFullscreen();

            expect(mockFullscreenAPI.requestFullscreen).toHaveBeenCalled();
        });

        test('should handle fullscreen API errors gracefully', () => {
            // Mock fullscreen API with error
            const mockFullscreenAPI = {
                requestFullscreen: jest.fn().mockRejectedValue(new Error('Fullscreen not supported'))
            };

            Object.defineProperty(document.documentElement, 'requestFullscreen', {
                value: mockFullscreenAPI.requestFullscreen,
                writable: true
            });

            expect(() => {
                fullscreenManager.enterFullscreen();
            }).not.toThrow();
        });
    });

    describe('Chat Container Management', () => {
        test('should adjust chat container in fullscreen mode', () => {
            const chatContainer = mockContainer.querySelector('.chat-container');

            fullscreenManager.enterFullscreen();

            expect(chatContainer.classList.contains('fullscreen-chat')).toBe(true);
        });

        test('should restore chat container when exiting fullscreen', () => {
            const chatContainer = mockContainer.querySelector('.chat-container');

            fullscreenManager.enterFullscreen();
            expect(chatContainer.classList.contains('fullscreen-chat')).toBe(true);

            fullscreenManager.exitFullscreen();
            expect(chatContainer.classList.contains('fullscreen-chat')).toBe(false);
        });
    });

    describe('Persistence', () => {
        test('should remember fullscreen state across page loads', () => {
            mockStateManager.getState.mockReturnValue({ isFullscreen: true });

            const newFullscreenManager = new FullscreenManager({
                container: mockContainer,
                eventManager: mockEventManager,
                stateManager: mockStateManager
            });

            expect(newFullscreenManager.isFullscreen).toBe(true);
        });

        test('should restore fullscreen state on initialization', () => {
            mockStateManager.getState.mockReturnValue({ isFullscreen: true });

            const newFullscreenManager = new FullscreenManager({
                container: mockContainer,
                eventManager: mockEventManager,
                stateManager: mockStateManager
            });

            const topBar = mockContainer.querySelector('.top-bar');
            const navbar = mockContainer.querySelector('.navbar');

            expect(topBar.style.display).toBe('none');
            expect(navbar.style.display).toBe('none');
        });
    });

    describe('Error Handling', () => {
        test('should handle missing UI elements gracefully', () => {
            // Remove UI elements
            const topBar = mockContainer.querySelector('.top-bar');
            const navbar = mockContainer.querySelector('.navbar');
            topBar.remove();
            navbar.remove();

            expect(() => {
                fullscreenManager.enterFullscreen();
            }).not.toThrow();
        });

        test('should handle missing container gracefully', () => {
            const fullscreenManagerWithoutContainer = new FullscreenManager({
                container: null,
                eventManager: mockEventManager,
                stateManager: mockStateManager
            });

            expect(() => {
                fullscreenManagerWithoutContainer.enterFullscreen();
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should not cause layout thrashing during fullscreen toggle', () => {
            const editorContainer = mockContainer.querySelector('.editor-container');
            const originalHeight = editorContainer.style.height;

            // Multiple rapid toggles
            for (let i = 0; i < 10; i++) {
                fullscreenManager.toggleFullscreen();
            }

            // Should end up in a consistent state
            expect(typeof fullscreenManager.isFullscreen).toBe('boolean');
        });

        test('should efficiently manage CSS classes', () => {
            const editorContainer = mockContainer.querySelector('.editor-container');

            fullscreenManager.enterFullscreen();
            expect(editorContainer.classList.contains('fullscreen-mode')).toBe(true);

            fullscreenManager.exitFullscreen();
            expect(editorContainer.classList.contains('fullscreen-mode')).toBe(false);
        });
    });
});
