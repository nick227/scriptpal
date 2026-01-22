/**
 * Tests for EditorToolbar Format functionality
 */

import { VALID_FORMATS, FORMAT_DISPLAY_NAMES } from '../../../constants/formats.js';
import { EditorToolbar } from '../../../widgets/editor/EditorToolbar.js';

describe('EditorToolbar - Format Buttons', () => {
    let toolbar;
    let mockContainer;
    let mockStateManager;
    let mockPageManager;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        document.body.appendChild(mockContainer);

        // Create mock state manager
        mockStateManager = {
            getCurrentPage: jest.fn().mockReturnValue(1),
            getState: jest.fn().mockReturnValue(false)
        };

        // Create mock page manager
        mockPageManager = {
            getTotalPages: jest.fn().mockReturnValue(1)
        };

        // Create toolbar
        toolbar = new EditorToolbar({
            container: mockContainer,
            stateManager: mockStateManager,
            pageManager: mockPageManager
        });

        toolbar.initialize();
    });

    afterEach(() => {
        if (mockContainer && mockContainer.parentNode) {
            mockContainer.parentNode.removeChild(mockContainer);
        }
        toolbar.destroy();
    });

    describe('Format button creation', () => {
        test('should create format dropdown trigger', () => {
            const dropdownTrigger = mockContainer.querySelector('.format-dropdown-trigger');
            expect(dropdownTrigger).toBeTruthy();
            expect(dropdownTrigger.textContent).toContain('Format');
        });

        test('should create format option buttons for all valid formats', () => {
            const formatOptions = mockContainer.querySelectorAll('.format-option');
            expect(formatOptions.length).toBe(Object.keys(VALID_FORMATS).length);
        });

        test('should set correct data attributes on format buttons', () => {
            const formatOptions = mockContainer.querySelectorAll('.format-option');
            formatOptions.forEach(button => {
                expect(button.dataset.format).toBeDefined();
                expect(Object.values(VALID_FORMATS)).toContain(button.dataset.format);
            });
        });

        test('should set correct display names on format buttons', () => {
            const formatOptions = mockContainer.querySelectorAll('.format-option');
            formatOptions.forEach(button => {
                const format = button.dataset.format;
                const expectedName = FORMAT_DISPLAY_NAMES[format];
                expect(button.textContent).toBe(expectedName);
            });
        });

        test('should set correct titles on format buttons', () => {
            const formatOptions = mockContainer.querySelectorAll('.format-option');
            formatOptions.forEach(button => {
                const format = button.dataset.format;
                const expectedTitle = `Format as ${FORMAT_DISPLAY_NAMES[format]}`;
                expect(button.title).toBe(expectedTitle);
            });
        });
    });

    describe('Format dropdown functionality', () => {
        test('should show dropdown when trigger is clicked', () => {
            const container = mockContainer.querySelector('.format-buttons-container');
            const dropdownTrigger = mockContainer.querySelector('.format-dropdown-trigger');
            const formatOptions = mockContainer.querySelectorAll('.format-option');

            // Initially hidden
            formatOptions.forEach(option => {
                expect(option.style.display).toBe('none');
            });

            // Click trigger
            dropdownTrigger.click();

            // Should show options
            formatOptions.forEach(option => {
                expect(option.style.display).toBe('block');
            });
            expect(container.classList.contains('dropdown-open')).toBe(true);
        });

        test('should hide dropdown when trigger is clicked again', () => {
            const container = mockContainer.querySelector('.format-buttons-container');
            const dropdownTrigger = mockContainer.querySelector('.format-dropdown-trigger');
            const formatOptions = mockContainer.querySelectorAll('.format-option');

            // Show dropdown
            dropdownTrigger.click();
            expect(container.classList.contains('dropdown-open')).toBe(true);

            // Hide dropdown
            dropdownTrigger.click();
            expect(container.classList.contains('dropdown-open')).toBe(false);
            formatOptions.forEach(option => {
                expect(option.style.display).toBe('none');
            });
        });

        test('should hide dropdown when clicking outside', () => {
            const container = mockContainer.querySelector('.format-buttons-container');
            const dropdownTrigger = mockContainer.querySelector('.format-dropdown-trigger');

            // Show dropdown
            dropdownTrigger.click();
            expect(container.classList.contains('dropdown-open')).toBe(true);

            // Click outside
            document.body.click();

            // Should hide dropdown
            expect(container.classList.contains('dropdown-open')).toBe(false);
        });
    });

    describe('Format selection', () => {
        test('should handle format selection', () => {
            const formatHandler = jest.fn();
            toolbar.onFormatSelected(formatHandler);

            const formatOption = mockContainer.querySelector('.format-option[data-format="action"]');
            formatOption.click();

            expect(formatHandler).toHaveBeenCalledWith('action');
        });

        test('should hide dropdown after format selection', () => {
            const container = mockContainer.querySelector('.format-buttons-container');
            const dropdownTrigger = mockContainer.querySelector('.format-dropdown-trigger');
            const formatOption = mockContainer.querySelector('.format-option[data-format="action"]');

            // Show dropdown
            dropdownTrigger.click();
            expect(container.classList.contains('dropdown-open')).toBe(true);

            // Select format
            formatOption.click();

            // Should hide dropdown
            expect(container.classList.contains('dropdown-open')).toBe(false);
        });

        test('should update active format display', () => {
            const dropdownTrigger = mockContainer.querySelector('.format-dropdown-trigger');
            const formatOption = mockContainer.querySelector('.format-option[data-format="action"]');

            // Select format
            formatOption.click();

            // Should update dropdown trigger text
            expect(dropdownTrigger.textContent).toContain(FORMAT_DISPLAY_NAMES.action);
        });

        test('should mark selected format as active', () => {
            const formatOption = mockContainer.querySelector('.format-option[data-format="action"]');

            // Select format
            formatOption.click();

            // Should mark as active
            expect(formatOption.classList.contains('active')).toBe(true);
        });
    });

    describe('Format button state management', () => {
        test('should update active format when set programmatically', () => {
            const dropdownTrigger = mockContainer.querySelector('.format-dropdown-trigger');
            const actionButton = mockContainer.querySelector('.format-option[data-format="action"]');
            const dialogButton = mockContainer.querySelector('.format-option[data-format="dialog"]');

            // Set active format
            toolbar.updateActiveFormat('action');

            // Should update dropdown trigger
            expect(dropdownTrigger.textContent).toContain(FORMAT_DISPLAY_NAMES.action);

            // Should mark correct button as active
            expect(actionButton.classList.contains('active')).toBe(true);
            expect(dialogButton.classList.contains('active')).toBe(false);

            // Change active format
            toolbar.updateActiveFormat('dialog');

            // Should update dropdown trigger
            expect(dropdownTrigger.textContent).toContain(FORMAT_DISPLAY_NAMES.dialog);

            // Should mark correct button as active
            expect(actionButton.classList.contains('active')).toBe(false);
            expect(dialogButton.classList.contains('active')).toBe(true);
        });

        test('should handle invalid format gracefully', () => {
            const dropdownTrigger = mockContainer.querySelector('.format-dropdown-trigger');

            // Should not throw
            expect(() => {
                toolbar.updateActiveFormat('invalid-format');
            }).not.toThrow();

            // Should not update dropdown trigger for invalid format
            const originalText = dropdownTrigger.textContent;
            toolbar.updateActiveFormat('invalid-format');
            expect(dropdownTrigger.textContent).toBe(originalText);
        });
    });

    describe('Format button integration', () => {
        test('should work with all valid formats', () => {
            const formatHandler = jest.fn();
            toolbar.onFormatSelected(formatHandler);

            Object.values(VALID_FORMATS).forEach(format => {
                const formatOption = mockContainer.querySelector(`.format-option[data-format="${format}"]`);
                expect(formatOption).toBeTruthy();

                // Should be able to select format
                formatOption.click();
                expect(formatHandler).toHaveBeenCalledWith(format);
            });
        });

        test('should maintain format button references', () => {
            Object.values(VALID_FORMATS).forEach(format => {
                const button = toolbar.formatButtons.get(format);
                expect(button).toBeTruthy();
                expect(button.dataset.format).toBe(format);
            });
        });
    });

    describe('Error handling', () => {
        test('should handle missing format display names gracefully', () => {
            // Temporarily remove format display names
            const originalDisplayNames = toolbar.formatDisplayNames;
            toolbar.formatDisplayNames = null;

            // Should not throw during initialization
            expect(() => {
                toolbar.createFormatButtons();
            }).not.toThrow();

            // Restore display names
            toolbar.formatDisplayNames = originalDisplayNames;
        });

        test('should handle missing formats gracefully', () => {
            // Temporarily remove formats
            const originalFormats = toolbar.formats;
            toolbar.formats = null;

            // Should not throw during initialization
            expect(() => {
                toolbar.createFormatButtons();
            }).not.toThrow();

            // Restore formats
            toolbar.formats = originalFormats;
        });
    });
});
