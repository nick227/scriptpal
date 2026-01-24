/**
 * Tests for TitlePageManager - Title Page Management
 */

import { TitlePageManager } from '../../../../widgets/editor/title/TitlePageManager.js';
import { StateManager } from '../../../../core/StateManager.js';

describe('TitlePageManager - Title Page Management', () => {
    let titlePageManager;
    let mockContainer;
    let mockStateManager;
    let mockEventManager;
    let mockApi;
    let mockScriptStore;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        mockContainer.className = 'editor-container';

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                author: 'Test Author',
                content: '<script><action>Test content</action></script>',
                version_number: 1,
                created_at: '2023-01-01T00:00:00Z'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            subscribe: jest.fn(),
            publish: jest.fn()
        };

        // Create mock API
        mockApi = {
            updateScript: jest.fn().mockResolvedValue({
                id: 1,
                title: 'Updated Script',
                author: 'Updated Author',
                updated_at: '2023-01-02T00:00:00Z'
            })
        };

        mockScriptStore = {
            getCurrentScript: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                author: 'Test Author',
                content: '<script><action>Test content</action></script>',
                version_number: 1
            }),
            updateScript: jest.fn().mockResolvedValue({
                id: 1,
                title: 'Updated Script',
                author: 'Updated Author',
                content: '<script><action>Test content</action></script>',
                version_number: 2
            })
        };

        // Create title page manager
        titlePageManager = new TitlePageManager({
            container: mockContainer,
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            api: mockApi,
            scriptStore: mockScriptStore
        });
    });

    afterEach(() => {
        titlePageManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(titlePageManager.container).toBe(mockContainer);
            expect(titlePageManager.stateManager).toBe(mockStateManager);
            expect(titlePageManager.eventManager).toBe(mockEventManager);
            expect(titlePageManager.api).toBe(mockApi);
            expect(titlePageManager.scriptStore).toBe(mockScriptStore);
        });

        test('should require container', () => {
            expect(() => {
                new TitlePageManager({
                    stateManager: mockStateManager,
                    eventManager: mockEventManager,
                    api: mockApi
                });
            }).toThrow('Container is required for TitlePageManager');
        });

        test('should require state manager', () => {
            expect(() => {
                new TitlePageManager({
                    container: mockContainer,
                    eventManager: mockEventManager,
                    api: mockApi
                });
            }).toThrow('StateManager is required for TitlePageManager');
        });

        test('should require event manager', () => {
            expect(() => {
                new TitlePageManager({
                    container: mockContainer,
                    stateManager: mockStateManager,
                    api: mockApi
                });
            }).toThrow('EventManager is required for TitlePageManager');
        });

        test('should require API', () => {
            expect(() => {
                new TitlePageManager({
                    container: mockContainer,
                    stateManager: mockStateManager,
                    eventManager: mockEventManager,
                    scriptStore: mockScriptStore
                });
            }).toThrow('API is required for TitlePageManager');
        });

        test('should require script store', () => {
            expect(() => {
                new TitlePageManager({
                    container: mockContainer,
                    stateManager: mockStateManager,
                    eventManager: mockEventManager,
                    api: mockApi
                });
            }).toThrow('ScriptStore is required for TitlePageManager');
        });

        test('should create title page element', () => {
            const titlePage = mockContainer.querySelector('.title-page');
            expect(titlePage).toBeTruthy();
            expect(titlePage.dataset.pageType).toBe('title');
        });

        test('should set up event listeners', () => {
            expect(mockStateManager.subscribe).toHaveBeenCalled();
            expect(mockEventManager.subscribe).toHaveBeenCalled();
        });
    });

    describe('Title Page Content', () => {
        test('should create title section', () => {
            const titleSection = mockContainer.querySelector('.title-section');
            expect(titleSection).toBeTruthy();

            const titleLabel = titleSection.querySelector('.title-label');
            const titleInput = titleSection.querySelector('.title-input');

            expect(titleLabel).toBeTruthy();
            expect(titleLabel.textContent).toBe('TITLE');
            expect(titleInput).toBeTruthy();
            expect(titleInput.type).toBe('text');
        });

        test('should create author section', () => {
            const authorSection = mockContainer.querySelector('.author-section');
            expect(authorSection).toBeTruthy();

            const authorLabel = authorSection.querySelector('.author-label');
            const authorInput = authorSection.querySelector('.author-input');

            expect(authorLabel).toBeTruthy();
            expect(authorLabel.textContent).toBe('AUTHOR');
            expect(authorInput).toBeTruthy();
            expect(authorInput.type).toBe('text');
        });

        test('should create date section', () => {
            const dateSection = mockContainer.querySelector('.date-section');
            expect(dateSection).toBeTruthy();

            const dateLabel = dateSection.querySelector('.date-label');
            const dateInput = dateSection.querySelector('.date-input');

            expect(dateLabel).toBeTruthy();
            expect(dateLabel.textContent).toBe('DATE');
            expect(dateInput).toBeTruthy();
            expect(dateInput.type).toBe('text');
        });

        test('should create edit button', () => {
            const editButton = mockContainer.querySelector('.title-page-edit-button');
            expect(editButton).toBeTruthy();
            expect(editButton.innerHTML).toContain('Edit');
        });
    });

    describe('Script Change Handling', () => {
        test('should handle script changes', () => {
            const newScript = {
                id: 2,
                title: 'New Script',
                author: 'New Author',
                created_at: '2023-01-02T00:00:00Z'
            };

            titlePageManager.handleScriptChange(newScript);

            expect(titlePageManager.titlePageData.title).toBe('New Script');
            expect(titlePageManager.titlePageData.author).toBe('New Author');
        });

        test('should update display on script change', () => {
            const newScript = {
                id: 2,
                title: 'New Script',
                author: 'New Author',
                created_at: '2023-01-02T00:00:00Z'
            };

            titlePageManager.handleScriptChange(newScript);

            const titleInput = mockContainer.querySelector('.title-input');
            const authorInput = mockContainer.querySelector('.author-input');

            expect(titleInput.value).toBe('New Script');
            expect(authorInput.value).toBe('New Author');
        });

        test('should handle null script gracefully', () => {
            expect(() => {
                titlePageManager.handleScriptChange(null);
            }).not.toThrow();
        });
    });

    describe('Editing Mode', () => {
        test('should enable editing mode', () => {
            titlePageManager.editTitlePage();

            expect(titlePageManager.titlePageData.isEditing).toBe(true);

            const titleInput = mockContainer.querySelector('.title-input');
            const authorInput = mockContainer.querySelector('.author-input');
            const dateInput = mockContainer.querySelector('.date-input');
            const editButton = mockContainer.querySelector('.title-page-edit-button');

            expect(titleInput.readOnly).toBe(false);
            expect(authorInput.readOnly).toBe(false);
            expect(dateInput.readOnly).toBe(true);
            expect(editButton.innerHTML).toContain('Save');
        });

        test('should disable editing mode by default', () => {
            const titleInput = mockContainer.querySelector('.title-input');
            const authorInput = mockContainer.querySelector('.author-input');
            const dateInput = mockContainer.querySelector('.date-input');

            expect(titleInput.readOnly).toBe(true);
            expect(authorInput.readOnly).toBe(true);
            expect(dateInput.readOnly).toBe(true);
        });

        test('should publish edit started event', () => {
            titlePageManager.editTitlePage();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'TITLE_PAGE.EDIT_STARTED',
                expect.objectContaining({
                    titlePageData: expect.any(Object)
                })
            );
        });
    });

    describe('Saving', () => {
        test('should save title page changes', async () => {
            // Enable editing mode
            titlePageManager.editTitlePage();

            // Update input values
            const titleInput = mockContainer.querySelector('.title-input');
            const authorInput = mockContainer.querySelector('.author-input');
            const dateInput = mockContainer.querySelector('.date-input');

            titleInput.value = 'Updated Title';
            authorInput.value = 'Updated Author';
            dateInput.value = 'Updated Date';

            // Save changes
            await titlePageManager.saveTitlePage();

            expect(titlePageManager.titlePageData.title).toBe('Updated Title');
            expect(titlePageManager.titlePageData.author).toBe('Updated Author');
            expect(titlePageManager.titlePageData.date).toBe('Updated Date');
            expect(titlePageManager.titlePageData.isEditing).toBe(false);
        });

        test('should save to script via API', async () => {
            titlePageManager.editTitlePage();

            const titleInput = mockContainer.querySelector('.title-input');
            titleInput.value = 'Updated Title';

            await titlePageManager.saveTitlePage();

            expect(mockScriptStore.updateScript).toHaveBeenCalledWith(1, expect.objectContaining({
                title: 'Updated Title',
                author: 'Test Author',
                content: '<script><action>Test content</action></script>',
                version_number: 1
            }));
        });

        test('should publish saved event', async () => {
            titlePageManager.editTitlePage();
            await titlePageManager.saveTitlePage();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'TITLE_PAGE.SAVED',
                expect.objectContaining({
                    titlePageData: expect.any(Object)
                })
            );
        });

        test('should handle save errors', async () => {
            mockScriptStore.updateScript.mockRejectedValue(new Error('Save failed'));

            titlePageManager.editTitlePage();
            await titlePageManager.saveTitlePage();

            // Should not throw error
            expect(titlePageManager.titlePageData.isEditing).toBe(false);
        });
    });

    describe('Title Page Data Management', () => {
        test('should get title page data', () => {
            const data = titlePageManager.getTitlePageData();

            expect(data).toHaveProperty('title');
            expect(data).toHaveProperty('author');
            expect(data).toHaveProperty('date');
            expect(data).toHaveProperty('isEditing');
        });

        test('should set title page data', () => {
            const newData = {
                title: 'New Title',
                author: 'New Author',
                date: 'New Date'
            };

            titlePageManager.setTitlePageData(newData);

            expect(titlePageManager.titlePageData.title).toBe('New Title');
            expect(titlePageManager.titlePageData.author).toBe('New Author');
            expect(titlePageManager.titlePageData.date).toBe('New Date');
        });

        test('should check editing state', () => {
            expect(titlePageManager.isEditing()).toBe(false);

            titlePageManager.editTitlePage();
            expect(titlePageManager.isEditing()).toBe(true);
        });

        test('should get title page element', () => {
            const element = titlePageManager.getTitlePageElement();

            expect(element).toBeTruthy();
            expect(element.classList.contains('title-page')).toBe(true);
        });
    });

    describe('Event Handling', () => {
        test('should handle title page update events', () => {
            const updateData = {
                title: 'Event Title',
                author: 'Event Author'
            };

            titlePageManager.handleTitlePageUpdate({
                titlePageData: updateData
            });

            expect(titlePageManager.titlePageData.title).toBe('Event Title');
            expect(titlePageManager.titlePageData.author).toBe('Event Author');
        });

        test('should handle empty update events', () => {
            expect(() => {
                titlePageManager.handleTitlePageUpdate({});
            }).not.toThrow();
        });
    });

    describe('Error Handling', () => {
        test('should show error messages', () => {
            titlePageManager.showError('Test error');

            const errorDiv = mockContainer.querySelector('.title-page-error');
            expect(errorDiv).toBeTruthy();
            expect(errorDiv.textContent).toBe('Test error');
        });

        test('should remove error messages after timeout', (done) => {
            titlePageManager.showError('Test error');

            setTimeout(() => {
                const errorDiv = mockContainer.querySelector('.title-page-error');
                expect(errorDiv).toBeFalsy();
                done();
            }, 3100);
        });
    });

    describe('Page Insertion', () => {
        test('should insert title page as first page', () => {
            // Create a mock editor page
            const editorPage = document.createElement('div');
            editorPage.className = 'editor-page';
            mockContainer.appendChild(editorPage);

            // Create new title page manager
            const newTitlePageManager = new TitlePageManager({
                container: mockContainer,
                stateManager: mockStateManager,
                eventManager: mockEventManager,
                api: mockApi,
                scriptStore: mockScriptStore
            });

            const titlePage = mockContainer.querySelector('.title-page');
            const { firstChild } = mockContainer;

            expect(firstChild).toBe(titlePage);
            expect(firstChild.classList.contains('title-page')).toBe(true);

            newTitlePageManager.destroy();
        });

        test('should insert title page when no other pages exist', () => {
            const titlePage = mockContainer.querySelector('.title-page');
            expect(titlePage).toBeTruthy();
            expect(mockContainer.contains(titlePage)).toBe(true);
        });
    });

    describe('Visibility handling', () => {
        test('retains the last known visibility when script payload lacks it', () => {
            titlePageManager.titlePageData.visibility = 'public';
            titlePageManager.visibilitySelect.value = 'public';

            const scriptWithoutVisibility = {
                id: 1,
                title: 'Updated Title',
                author: 'Updated Author',
                content: '<script></script>',
                createdAt: '2026-01-01T00:00:00Z'
            };

            titlePageManager.handleScriptChange(scriptWithoutVisibility);

            expect(titlePageManager.titlePageData.visibility).toBe('public');
            expect(titlePageManager.visibilitySelect.value).toBe('public');
        });

        test('updates the visibility when the script payload includes it', () => {
            titlePageManager.titlePageData.visibility = 'private';
            titlePageManager.visibilitySelect.value = 'private';

            const scriptWithPublicVisibility = {
                id: 1,
                title: 'Updated Title',
                author: 'Updated Author',
                content: '<script></script>',
                visibility: 'public',
                createdAt: '2026-01-01T00:00:00Z'
            };

            titlePageManager.handleScriptChange(scriptWithPublicVisibility);

            expect(titlePageManager.titlePageData.visibility).toBe('public');
            expect(titlePageManager.visibilitySelect.value).toBe('public');
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            titlePageManager.destroy();

            expect(titlePageManager.container).toBeNull();
            expect(titlePageManager.stateManager).toBeNull();
            expect(titlePageManager.eventManager).toBeNull();
            expect(titlePageManager.api).toBeNull();
            expect(titlePageManager.titlePage).toBeNull();
            expect(titlePageManager.titlePageData).toBeNull();
        });

        test('should remove title page from DOM on destroy', () => {
            const titlePage = mockContainer.querySelector('.title-page');
            expect(titlePage).toBeTruthy();

            titlePageManager.destroy();

            const titlePageAfterDestroy = mockContainer.querySelector('.title-page');
            expect(titlePageAfterDestroy).toBeFalsy();
        });
    });
});
