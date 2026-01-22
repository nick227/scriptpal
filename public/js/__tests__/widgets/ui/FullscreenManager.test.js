/**
 * Tests for FullscreenManager - Fullscreen Mode Management
 */

import { FullscreenManager } from '../../../widgets/ui/FullscreenManager.js';

describe('FullscreenManager - Fullscreen Mode Management', () => {
    let fullscreenManager;
    let mockStateManager;
    let mockEventManager;
    let mockNavbar;
    let mockTopBar;
    let mockContainerMain;
    let mockEditorContainer;
    let mockChatContainer;

    beforeEach(() => {
        // Create mock DOM elements
        mockNavbar = document.createElement('div');
        mockNavbar.className = 'navbar';
        mockNavbar.style.display = 'block';

        mockTopBar = document.createElement('div');
        mockTopBar.className = 'button-set site-controls';
        mockTopBar.style.display = 'block';

        mockContainerMain = document.createElement('div');
        mockContainerMain.className = 'container-main';
        mockContainerMain.style.position = 'relative';

        mockEditorContainer = document.createElement('div');
        mockEditorContainer.className = 'editor-container';
        mockEditorContainer.style.height = '500px';

        mockChatContainer = document.createElement('div');
        mockChatContainer.className = 'chatbot-container';

        // Add elements to document
        document.body.appendChild(mockNavbar);
        document.body.appendChild(mockTopBar);
        document.body.appendChild(mockContainerMain);
        document.body.appendChild(mockEditorContainer);
        document.body.appendChild(mockChatContainer);

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn(),
            setState: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create fullscreen manager
        fullscreenManager = new FullscreenManager({
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });
    });

    afterEach(() => {
        fullscreenManager.destroy();

        // Clean up DOM elements
        document.body.removeChild(mockNavbar);
        document.body.removeChild(mockTopBar);
        document.body.removeChild(mockContainerMain);
        document.body.removeChild(mockEditorContainer);
        document.body.removeChild(mockChatContainer);
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(fullscreenManager.stateManager).toBe(mockStateManager);
            expect(fullscreenManager.eventManager).toBe(mockEventManager);
        });

        test('should require state manager', () => {
            expect(() => {
                new FullscreenManager({
                    eventManager: mockEventManager
                });
            }).toThrow('StateManager is required for FullscreenManager');
        });

        test('should require event manager', () => {
            expect(() => {
                new FullscreenManager({
                    stateManager: mockStateManager
                });
            }).toThrow('EventManager is required for FullscreenManager');
        });

        test('should find UI elements', () => {
            expect(fullscreenManager.navbar).toBe(mockNavbar);
            expect(fullscreenManager.topBar).toBe(mockTopBar);
            expect(fullscreenManager.containerMain).toBe(mockContainerMain);
            expect(fullscreenManager.editorContainer).toBe(mockEditorContainer);
            expect(fullscreenManager.chatContainer).toBe(mockChatContainer);
        });

        test('should set up event listeners', () => {
            expect(mockEventManager.subscribe).toHaveBeenCalledWith(
                'UI.FULLSCREEN_TOGGLE',
                expect.any(Function)
            );
        });

        test('should have default state', () => {
            expect(fullscreenManager.isFullscreen).toBe(false);
        });
    });

    describe('Fullscreen Toggle', () => {
        test('should toggle fullscreen state', async () => {
            expect(fullscreenManager.isFullscreen).toBe(false);

            await fullscreenManager.toggleFullscreen();
            expect(fullscreenManager.isFullscreen).toBe(true);

            await fullscreenManager.toggleFullscreen();
            expect(fullscreenManager.isFullscreen).toBe(false);
        });

        test('should enter fullscreen mode', async () => {
            await fullscreenManager.enterFullscreen();

            expect(fullscreenManager.isFullscreen).toBe(true);
            expect(mockNavbar.style.display).toBe('none');
            expect(mockTopBar.style.display).toBe('none');
            expect(mockContainerMain.classList.contains('fullscreen-mode')).toBe(true);
            expect(document.body.classList.contains('fullscreen-mode')).toBe(true);
        });

        test('should exit fullscreen mode', async () => {
            // First enter fullscreen
            await fullscreenManager.enterFullscreen();

            // Then exit
            await fullscreenManager.exitFullscreen();

            expect(fullscreenManager.isFullscreen).toBe(false);
            expect(mockNavbar.style.display).toBe('block');
            expect(mockTopBar.style.display).toBe('block');
            expect(mockContainerMain.classList.contains('fullscreen-mode')).toBe(false);
            expect(document.body.classList.contains('fullscreen-mode')).toBe(false);
        });
    });

    describe('Element Management', () => {
        test('should hide elements', () => {
            fullscreenManager.hideElement(mockNavbar);

            expect(mockNavbar.style.display).toBe('none');
            expect(fullscreenManager.hiddenElements).toContain(mockNavbar);
        });

        test('should show elements', () => {
            // First hide
            fullscreenManager.hideElement(mockNavbar);

            // Then show
            fullscreenManager.showElement(mockNavbar);

            expect(mockNavbar.style.display).toBe('block');
            expect(fullscreenManager.hiddenElements).not.toContain(mockNavbar);
        });

        test('should save element styles', () => {
            fullscreenManager.saveElementStyles(mockContainerMain);

            expect(fullscreenManager.originalStyles.has(mockContainerMain)).toBe(true);
        });

        test('should restore element styles', () => {
            // Save styles first
            fullscreenManager.saveElementStyles(mockContainerMain);

            // Change styles
            mockContainerMain.style.position = 'fixed';

            // Restore styles
            fullscreenManager.restoreElementStyles(mockContainerMain);

            expect(fullscreenManager.originalStyles.has(mockContainerMain)).toBe(false);
        });
    });

    describe('Keyboard Shortcuts', () => {
        test('should handle F11 key', () => {
            const event = new KeyboardEvent('keydown', { key: 'F11' });
            const toggleSpy = jest.spyOn(fullscreenManager, 'toggleFullscreen');

            fullscreenManager.handleKeyDown(event);

            expect(toggleSpy).toHaveBeenCalled();
        });

        test('should handle Escape key when fullscreen', () => {
            fullscreenManager.isFullscreen = true;
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            const exitSpy = jest.spyOn(fullscreenManager, 'exitFullscreen');

            fullscreenManager.handleKeyDown(event);

            expect(exitSpy).toHaveBeenCalled();
        });

        test('should handle Ctrl+Shift+F key', () => {
            const event = new KeyboardEvent('keydown', {
                key: 'F',
                ctrlKey: true,
                shiftKey: true
            });
            const toggleSpy = jest.spyOn(fullscreenManager, 'toggleFullscreen');

            fullscreenManager.handleKeyDown(event);

            expect(toggleSpy).toHaveBeenCalled();
        });

        test('should not handle Escape key when not fullscreen', () => {
            fullscreenManager.isFullscreen = false;
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            const exitSpy = jest.spyOn(fullscreenManager, 'exitFullscreen');

            fullscreenManager.handleKeyDown(event);

            expect(exitSpy).not.toHaveBeenCalled();
        });
    });

    describe('Fullscreen API Integration', () => {
        test('should check fullscreen support', () => {
            const isSupported = fullscreenManager.isFullscreenSupported();
            expect(typeof isSupported).toBe('boolean');
        });

        test('should get fullscreen API name', () => {
            const apiName = fullscreenManager.getFullscreenAPIName();
            expect(['standard', 'webkit', 'moz', 'ms', 'custom']).toContain(apiName);
        });

        test('should handle fullscreen change events', () => {
            const event = new Event('fullscreenchange');
            const applySpy = jest.spyOn(fullscreenManager, 'applyFullscreenState');

            fullscreenManager.handleFullscreenChange(event);

            expect(applySpy).toHaveBeenCalled();
        });
    });

    describe('State Management', () => {
        test('should get fullscreen state', () => {
            const state = fullscreenManager.getFullscreenState();
            expect(state).toBe(false);
        });

        test('should set fullscreen state', () => {
            const applySpy = jest.spyOn(fullscreenManager, 'applyFullscreenState');

            fullscreenManager.setFullscreenState(true);

            expect(fullscreenManager.isFullscreen).toBe(true);
            expect(applySpy).toHaveBeenCalled();
        });

        test('should not apply state if already set', () => {
            const applySpy = jest.spyOn(fullscreenManager, 'applyFullscreenState');

            fullscreenManager.setFullscreenState(false);

            expect(applySpy).not.toHaveBeenCalled();
        });
    });

    describe('State Persistence', () => {
        test('should save state to localStorage', () => {
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

            fullscreenManager.saveState();

            expect(setItemSpy).toHaveBeenCalledWith(
                'fullscreenState',
                expect.stringContaining('"isFullscreen"')
            );
        });

        test('should load state from localStorage', () => {
            const savedState = { isFullscreen: true };
            jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(savedState));

            const newManager = new FullscreenManager({
                stateManager: mockStateManager,
                eventManager: mockEventManager
            });

            expect(newManager.isFullscreen).toBe(true);

            newManager.destroy();
        });

        test('should handle localStorage errors gracefully', () => {
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('Storage error');
            });

            expect(() => {
                new FullscreenManager({
                    stateManager: mockStateManager,
                    eventManager: mockEventManager
                });
            }).not.toThrow();
        });
    });

    describe('UI Button Creation', () => {
        test('should create fullscreen toggle button', () => {
            const button = fullscreenManager.createFullscreenToggleButton();

            expect(button).toBeTruthy();
            expect(button.classList.contains('fullscreen-toggle-button')).toBe(true);
            expect(button.innerHTML).toContain('fa-expand');
        });

        test('should update fullscreen toggle button', () => {
            const button = fullscreenManager.createFullscreenToggleButton();

            fullscreenManager.isFullscreen = true;
            fullscreenManager.updateFullscreenToggleButton(button);

            expect(button.innerHTML).toContain('fa-compress');
            expect(button.title).toBe('Exit Fullscreen');
        });

        test('should handle button click', () => {
            const button = fullscreenManager.createFullscreenToggleButton();
            const toggleSpy = jest.spyOn(fullscreenManager, 'toggleFullscreen');

            button.click();

            expect(toggleSpy).toHaveBeenCalled();
        });
    });

    describe('Event Emission', () => {
        test('should emit fullscreen entered event', () => {
            fullscreenManager.enterFullscreenMode();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'UI.FULLSCREEN_ENTERED',
                {}
            );
        });

        test('should emit fullscreen exited event', () => {
            fullscreenManager.exitFullscreenMode();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'UI.FULLSCREEN_EXITED',
                {}
            );
        });

        test('should emit fullscreen changed event', () => {
            fullscreenManager.isFullscreen = true;
            fullscreenManager.handleFullscreenChange(new Event('fullscreenchange'));

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'UI.FULLSCREEN_CHANGED',
                { isFullscreen: true }
            );
        });
    });

    describe('Window Resize Handling', () => {
        test('should handle window resize when fullscreen', () => {
            fullscreenManager.isFullscreen = true;
            const applySpy = jest.spyOn(fullscreenManager, 'applyFullscreenState');

            fullscreenManager.handleWindowResize(new Event('resize'));

            expect(applySpy).toHaveBeenCalled();
        });

        test('should not handle window resize when not fullscreen', () => {
            fullscreenManager.isFullscreen = false;
            const applySpy = jest.spyOn(fullscreenManager, 'applyFullscreenState');

            fullscreenManager.handleWindowResize(new Event('resize'));

            expect(applySpy).not.toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            fullscreenManager.destroy();

            expect(fullscreenManager.stateManager).toBeNull();
            expect(fullscreenManager.eventManager).toBeNull();
            expect(fullscreenManager.navbar).toBeNull();
            expect(fullscreenManager.topBar).toBeNull();
            expect(fullscreenManager.containerMain).toBeNull();
            expect(fullscreenManager.editorContainer).toBeNull();
            expect(fullscreenManager.chatContainer).toBeNull();
        });

        test('should exit fullscreen on destroy', () => {
            fullscreenManager.isFullscreen = true;
            const exitSpy = jest.spyOn(fullscreenManager, 'exitFullscreen');

            fullscreenManager.destroy();

            expect(exitSpy).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle fullscreen API errors gracefully', async () => {
            // Mock requestFullscreen to throw error
            const originalRequestFullscreen = document.documentElement.requestFullscreen;
            document.documentElement.requestFullscreen = jest.fn().mockRejectedValue(new Error('Fullscreen error'));

            await fullscreenManager.enterFullscreen();

            expect(fullscreenManager.isFullscreen).toBe(true);

            // Restore original method
            document.documentElement.requestFullscreen = originalRequestFullscreen;
        });

        test('should handle exit fullscreen API errors gracefully', async () => {
            // Mock exitFullscreen to throw error
            const originalExitFullscreen = document.exitFullscreen;
            document.exitFullscreen = jest.fn().mockRejectedValue(new Error('Exit fullscreen error'));

            fullscreenManager.isFullscreen = true;
            await fullscreenManager.exitFullscreen();

            expect(fullscreenManager.isFullscreen).toBe(false);

            // Restore original method
            document.exitFullscreen = originalExitFullscreen;
        });
    });
});
