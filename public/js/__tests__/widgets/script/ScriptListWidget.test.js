/**
 * Tests for ScriptListWidget - Script List Management
 */

import { ScriptListWidget } from '../../../widgets/script/ScriptListWidget.js';

describe('ScriptListWidget - Script List Management', () => {
    let scriptListWidget;
    let mockContainer;
    let mockStateManager;
    let mockEventManager;

    beforeEach(() => {
        // Create mock container and attach to document
        mockContainer = document.createElement('div');
        document.body.appendChild(mockContainer);

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({ id: 1, email: 'test@example.com' }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            subscribe: jest.fn(),
            publish: jest.fn()
        };

        // Create script list widget
        scriptListWidget = new ScriptListWidget({
            container: mockContainer,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });
    });

    afterEach(() => {
        if (scriptListWidget) {
            scriptListWidget.destroy();
        }

        // Clean up DOM
        if (mockContainer && mockContainer.parentNode) {
            mockContainer.parentNode.removeChild(mockContainer);
        }
    });

    describe('Requirement #1: Script List Dropdown Functionality', () => {
        test('should create dropdown UI with script list', () => {
            expect(mockContainer.querySelector('.script-list-dropdown')).toBeTruthy();
            expect(mockContainer.querySelector('.script-dropdown-trigger')).toBeTruthy();
            expect(mockContainer.querySelector('.script-dropdown-menu')).toBeTruthy();
            expect(mockContainer.querySelector('.script-list')).toBeTruthy();
            expect(mockContainer.querySelector('.create-script-button')).toBeTruthy();
        });

        test('should render multiple scripts in dropdown', () => {
            const scripts = [
                { id: 1, title: 'Test Script 1', status: 'draft', created_at: '2023-01-01T00:00:00Z' },
                { id: 2, title: 'Test Script 2', status: 'active', created_at: '2023-01-02T00:00:00Z' }
            ];

            scriptListWidget.handleScriptsStateUpdate(scripts);

            const scriptItems = mockContainer.querySelectorAll('.script-item');
            expect(scriptItems.length).toBe(2);
        });

        test('should allow creating new scripts', async () => {
            global.prompt = jest.fn().mockReturnValue('New Test Script');

            await scriptListWidget.handleCreateScript();

            expect(mockEventManager.publish).toHaveBeenCalledWith('SCRIPT:CREATE_REQUESTED', {
                title: 'New Test Script',
                content: ''
            });
        });

        test('should allow deleting scripts', async () => {
            const scriptToDelete = { id: 1, title: 'Test Script 1' };
            scriptListWidget.scripts = [scriptToDelete];

            global.confirm = jest.fn().mockReturnValue(true);

            await scriptListWidget.handleDeleteScript(scriptToDelete);

            expect(mockEventManager.publish).toHaveBeenCalledWith('SCRIPT:DELETE_REQUESTED', {
                scriptId: 1,
                title: 'Test Script 1'
            });
        });

        test('should allow switching between scripts', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };
            scriptListWidget.scripts = [script1, script2];

            await scriptListWidget.handleSelectScript(script2);

            expect(mockEventManager.publish).toHaveBeenCalledWith('SCRIPT:SELECT_REQUESTED', {
                scriptId: 2,
                source: 'list'
            });
        });

        test('should show loading state during operations', () => {
            scriptListWidget.setLoading(true);
            expect(scriptListWidget.isLoading).toBe(true);
            scriptListWidget.setLoading(false);
            expect(scriptListWidget.isLoading).toBe(false);
        });
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(scriptListWidget.container).toBe(mockContainer);
            expect(scriptListWidget.stateManager).toBe(mockStateManager);
            expect(scriptListWidget.eventManager).toBe(mockEventManager);
        });

        test('should require container', () => {
            expect(() => {
                new ScriptListWidget({
                    stateManager: mockStateManager,
                    eventManager: mockEventManager
                });
            }).toThrow('Container is required for ScriptListWidget');
        });

        test('should require state manager', () => {
            expect(() => {
                new ScriptListWidget({
                    container: mockContainer,
                    eventManager: mockEventManager
                });
            }).toThrow('StateManager is required for ScriptListWidget');
        });

        test('should require event manager', () => {
            expect(() => {
                new ScriptListWidget({
                    container: mockContainer,
                    stateManager: mockStateManager
                });
            }).toThrow('EventManager is required for ScriptListWidget');
        });

        test('should create UI elements', () => {
            expect(mockContainer.querySelector('.script-list-dropdown')).toBeTruthy();
            expect(mockContainer.querySelector('.script-dropdown-trigger')).toBeTruthy();
            expect(mockContainer.querySelector('.script-dropdown-menu')).toBeTruthy();
            expect(mockContainer.querySelector('.script-list')).toBeTruthy();
            expect(mockContainer.querySelector('.create-script-button')).toBeTruthy();
        });

        test('should set up event listeners', () => {
            expect(mockStateManager.subscribe).toHaveBeenCalled();
            expect(mockEventManager.subscribe).toHaveBeenCalled();
        });
    });

    describe('Script List UI', () => {
        test('should update script list UI', () => {
            const scripts = [
                { id: 1, title: 'New Script 1' },
                { id: 2, title: 'New Script 2' }
            ];

            scriptListWidget.handleScriptsStateUpdate(scripts);

            const scriptItems = mockContainer.querySelectorAll('.script-item');
            expect(scriptItems.length).toBe(2);
        });

        test('should show empty state when no scripts', () => {
            scriptListWidget.handleScriptsStateUpdate([]);

            const emptyState = mockContainer.querySelector('.empty-state');
            expect(emptyState).toBeTruthy();
        });

        test('should create script items with correct data', () => {
            const scripts = [
                { id: 1, title: 'Script 1' },
                { id: 2, title: 'Script 2' }
            ];

            scriptListWidget.handleScriptsStateUpdate(scripts);

            const scriptItems = mockContainer.querySelectorAll('.script-item');
            expect(scriptItems[0].dataset.scriptId).toBe('1');
            expect(scriptItems[1].dataset.scriptId).toBe('2');
        });

        test('should format dates correctly', () => {
            const now = new Date();
            const today = now.toISOString();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

            expect(scriptListWidget.formatDate(today)).toBe('Today');
            expect(scriptListWidget.formatDate(yesterday)).toBe('Yesterday');
            expect(scriptListWidget.formatDate(weekAgo)).toBe('6 days ago');
        });
    });

    describe('Script Selection', () => {
        test('should handle script selection', async () => {
            const script = { id: 1, title: 'Test Script', status: 'draft' };

            await scriptListWidget.handleSelectScript(script);

            expect(mockEventManager.publish).toHaveBeenCalledWith('SCRIPT:SELECT_REQUESTED', {
                scriptId: 1,
                source: 'list'
            });
        });

        test('should update dropdown trigger text from state', () => {
            const script = { id: 1, title: 'Test Script', status: 'draft' };

            scriptListWidget.handleScriptChange(script);

            const triggerText = mockContainer.querySelector('.script-title');
            expect(triggerText.textContent).toBe('Test Script');
        });

        test('should close dropdown after selection', async () => {
            const script = { id: 1, title: 'Test Script', status: 'draft' };

            scriptListWidget.openDropdown();
            expect(scriptListWidget.isDropdownOpen).toBe(true);

            await scriptListWidget.handleSelectScript(script);

            expect(scriptListWidget.isDropdownOpen).toBe(false);
        });
    });

    describe('Script Creation', () => {
        test('should handle script creation', async () => {
            global.prompt = jest.fn().mockReturnValue('New Script Title');

            await scriptListWidget.handleCreateScript();

            expect(mockEventManager.publish).toHaveBeenCalledWith('SCRIPT:CREATE_REQUESTED', {
                title: 'New Script Title',
                content: ''
            });
        });

        test('should handle empty title', async () => {
            global.prompt = jest.fn().mockReturnValue('');

            await scriptListWidget.handleCreateScript();

            expect(mockEventManager.publish).not.toHaveBeenCalledWith('SCRIPT:CREATE_REQUESTED', expect.anything());
        });

        test('should handle cancelled prompt', async () => {
            global.prompt = jest.fn().mockReturnValue(null);

            await scriptListWidget.handleCreateScript();

            expect(mockEventManager.publish).not.toHaveBeenCalledWith('SCRIPT:CREATE_REQUESTED', expect.anything());
        });
    });

    describe('Script Deletion', () => {
        test('should handle script deletion', async () => {
            global.confirm = jest.fn().mockReturnValue(true);

            const script = { id: 1, title: 'Test Script', status: 'draft' };
            scriptListWidget.scripts = [script];

            await scriptListWidget.handleDeleteScript(script);

            expect(mockEventManager.publish).toHaveBeenCalledWith('SCRIPT:DELETE_REQUESTED', {
                scriptId: 1,
                title: 'Test Script'
            });
        });

        test('should handle deletion cancellation', async () => {
            global.confirm = jest.fn().mockReturnValue(false);

            const script = { id: 1, title: 'Test Script', status: 'draft' };

            await scriptListWidget.handleDeleteScript(script);

            expect(mockEventManager.publish).not.toHaveBeenCalledWith('SCRIPT:DELETE_REQUESTED', expect.anything());
        });
    });

    describe('Dropdown Management', () => {
        test('should toggle dropdown', () => {
            expect(scriptListWidget.isDropdownOpen).toBe(false);

            scriptListWidget.toggleDropdown();
            expect(scriptListWidget.isDropdownOpen).toBe(true);

            scriptListWidget.toggleDropdown();
            expect(scriptListWidget.isDropdownOpen).toBe(false);
        });

        test('should open dropdown', () => {
            scriptListWidget.openDropdown();

            expect(scriptListWidget.isDropdownOpen).toBe(true);
            expect(mockContainer.querySelector('.script-dropdown-menu').style.display).toBe('block');
        });

        test('should close dropdown', () => {
            scriptListWidget.openDropdown();
            scriptListWidget.closeDropdown();

            expect(scriptListWidget.isDropdownOpen).toBe(false);
            expect(mockContainer.querySelector('.script-dropdown-menu').style.display).toBe('none');
        });

        test('should close dropdown when clicking outside', () => {
            scriptListWidget.openDropdown();

            const outsideElement = document.createElement('div');
            document.body.appendChild(outsideElement);
            outsideElement.click();

            expect(scriptListWidget.isDropdownOpen).toBe(false);

            document.body.removeChild(outsideElement);
        });
    });

    describe('State Management', () => {
        test('should handle script change from state manager', () => {
            const script = { id: 1, title: 'New Script', status: 'draft' };

            scriptListWidget.handleScriptChange(script);

            expect(scriptListWidget.currentScript).toBe(script);
        });

        test('should handle script list update from event manager', () => {
            const newScripts = [
                { id: 1, title: 'Script 1', status: 'draft' },
                { id: 2, title: 'Script 2', status: 'active' }
            ];

            scriptListWidget.handleScriptListUpdate({ scripts: newScripts });

            expect(scriptListWidget.scripts).toBe(newScripts);
        });
    });

    describe('Utility Methods', () => {
        test('should refresh script list', () => {
            scriptListWidget.refresh();

            expect(mockEventManager.publish).toHaveBeenCalledWith('SCRIPT:LIST_REQUESTED', {
                source: 'refresh',
                force: true
            });
        });

        test('should get current scripts', () => {
            scriptListWidget.scripts = [{ id: 1, title: 'Test' }];

            expect(scriptListWidget.getScripts()).toHaveLength(1);
        });

        test('should get current script', () => {
            const script = { id: 1, title: 'Test' };
            scriptListWidget.currentScript = script;

            expect(scriptListWidget.getCurrentScript()).toBe(script);
        });
    });

    describe('Error Handling', () => {
        test('should show error messages', () => {
            scriptListWidget.showError('Test error');

            const errorMessage = mockContainer.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toBe('Test error');
        });

        test('should remove error messages after timeout', (done) => {
            scriptListWidget.showError('Test error');

            setTimeout(() => {
                const errorMessage = mockContainer.querySelector('.error-message');
                expect(errorMessage).toBeFalsy();
                done();
            }, 3100);
        });
    });

    describe('Loading State', () => {
        test('should show loading indicator', () => {
            scriptListWidget.setLoading(true);

            const loadingIndicator = mockContainer.querySelector('.loading-indicator');
            expect(loadingIndicator.style.display).toBe('block');
        });

        test('should hide loading indicator', () => {
            scriptListWidget.setLoading(false);

            const loadingIndicator = mockContainer.querySelector('.loading-indicator');
            expect(loadingIndicator.style.display).toBe('none');
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            scriptListWidget.destroy();

            expect(scriptListWidget.container).toBeNull();
            expect(scriptListWidget.stateManager).toBeNull();
            expect(scriptListWidget.eventManager).toBeNull();
            expect(scriptListWidget.scripts).toHaveLength(0);
            expect(scriptListWidget.currentScript).toBeNull();
        });
    });
});