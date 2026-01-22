/**
 * Tests for Requirement #24: Format buttons in controls
 */

import { EditorToolbar } from '../../widgets/editor/EditorToolbar.js';

describe('Requirement #24: Format Buttons in Controls', () => {
    let editorToolbar;
    let mockContainer;
    let mockStateManager;
    let mockEventManager;
    let mockLineFormatter;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        mockContainer.innerHTML = `
            <div class="editor-toolbar">
                <div class="format-controls">
                    <select class="format-dropdown">
                        <option value="action">Action</option>
                        <option value="character">Character</option>
                        <option value="dialogue">Dialogue</option>
                        <option value="parenthetical">Parenthetical</option>
                    </select>
                </div>
            </div>
        `;

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                currentFormat: 'action'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock line formatter
        mockLineFormatter = {
            setLineFormat: jest.fn(),
            getCurrentFormat: jest.fn().mockReturnValue('action')
        };

        // Create editor toolbar
        editorToolbar = new EditorToolbar({
            container: mockContainer,
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            lineFormatter: mockLineFormatter
        });
    });

    afterEach(() => {
        editorToolbar.destroy();
    });

    describe('Format Dropdown Creation', () => {
        test('should create format dropdown with all format options', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            expect(formatDropdown).toBeTruthy();

            const options = formatDropdown.querySelectorAll('option');
            expect(options).toHaveLength(4);

            expect(options[0].value).toBe('action');
            expect(options[1].value).toBe('character');
            expect(options[2].value).toBe('dialogue');
            expect(options[3].value).toBe('parenthetical');
        });

        test('should set current format as selected option', () => {
            mockStateManager.getState.mockReturnValue({
                currentFormat: 'dialogue'
            });

            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            expect(formatDropdown.value).toBe('dialogue');
        });

        test('should display format names correctly', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            const options = formatDropdown.querySelectorAll('option');

            expect(options[0].textContent).toBe('Action');
            expect(options[1].textContent).toBe('Character');
            expect(options[2].textContent).toBe('Dialogue');
            expect(options[3].textContent).toBe('Parenthetical');
        });

        test('should apply proper CSS classes to format controls', () => {
            editorToolbar.createFormatButtons();

            const formatControls = mockContainer.querySelector('.format-controls');
            expect(formatControls).toBeTruthy();
            expect(formatControls.classList.contains('format-controls')).toBe(true);
        });
    });

    describe('Format Selection Handling', () => {
        test('should handle format selection change', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'character';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            expect(mockLineFormatter.setLineFormat).toHaveBeenCalledWith(
                expect.any(Element),
                'character'
            );
        });

        test('should update state manager when format changes', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'dialogue';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            expect(mockStateManager.setState).toHaveBeenCalledWith(
                'CURRENT_FORMAT',
                'dialogue'
            );
        });

        test('should publish format change event', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'parenthetical';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'EDITOR:FORMAT_CHANGED',
                {
                    format: 'parenthetical',
                    previousFormat: 'action'
                }
            );
        });

        test('should handle all format types', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            const formats = ['action', 'character', 'dialogue', 'parenthetical'];

            formats.forEach(format => {
                formatDropdown.value = format;

                const changeEvent = new Event('change', { bubbles: true });
                formatDropdown.dispatchEvent(changeEvent);

                expect(mockLineFormatter.setLineFormat).toHaveBeenCalledWith(
                    expect.any(Element),
                    format
                );
            });
        });
    });

    describe('Format Button States', () => {
        test('should update format dropdown when current format changes', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');

            // Simulate format change
            mockStateManager.getState.mockReturnValue({
                currentFormat: 'character'
            });

            editorToolbar.updateFormatState();

            expect(formatDropdown.value).toBe('character');
        });

        test('should disable format controls when editor is disabled', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');

            editorToolbar.setEnabled(false);

            expect(formatDropdown.disabled).toBe(true);
        });

        test('should enable format controls when editor is enabled', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');

            editorToolbar.setEnabled(false);
            editorToolbar.setEnabled(true);

            expect(formatDropdown.disabled).toBe(false);
        });

        test('should highlight current format in dropdown', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'dialogue';

            editorToolbar.highlightCurrentFormat();

            const selectedOption = formatDropdown.querySelector('option:checked');
            expect(selectedOption.value).toBe('dialogue');
        });
    });

    describe('Format Button Integration', () => {
        test('should integrate with line formatter', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'character';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            expect(mockLineFormatter.setLineFormat).toHaveBeenCalled();
        });

        test('should integrate with state manager', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'dialogue';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            expect(mockStateManager.setState).toHaveBeenCalled();
        });

        test('should integrate with event system', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'parenthetical';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            expect(mockEventManager.publish).toHaveBeenCalled();
        });

        test('should work with keyboard manager for format shortcuts', () => {
            const mockKeyboardManager = {
                handleFormatChange: jest.fn()
            };

            editorToolbar.keyboardManager = mockKeyboardManager;

            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'action';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            expect(mockKeyboardManager.handleFormatChange).toHaveBeenCalledWith('action');
        });
    });

    describe('Format Button Styling', () => {
        test('should apply proper styling to format dropdown', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            expect(formatDropdown.classList.contains('format-dropdown')).toBe(true);
        });

        test('should apply active state styling to current format', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'character';

            editorToolbar.updateFormatState();

            const selectedOption = formatDropdown.querySelector('option:checked');
            expect(selectedOption).toBeTruthy();
        });

        test('should apply disabled state styling when disabled', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');

            editorToolbar.setEnabled(false);

            expect(formatDropdown.classList.contains('disabled')).toBe(true);
        });

        test('should apply hover effects to format options', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            const option = formatDropdown.querySelector('option[value="character"]');

            const mouseOverEvent = new MouseEvent('mouseover', { bubbles: true });
            option.dispatchEvent(mouseOverEvent);

            expect(option.classList.contains('hover')).toBe(true);
        });
    });

    describe('Format Button Events', () => {
        test('should handle format dropdown focus events', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');

            const focusEvent = new Event('focus', { bubbles: true });
            formatDropdown.dispatchEvent(focusEvent);

            expect(formatDropdown.classList.contains('focused')).toBe(true);
        });

        test('should handle format dropdown blur events', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');

            const blurEvent = new Event('blur', { bubbles: true });
            formatDropdown.dispatchEvent(blurEvent);

            expect(formatDropdown.classList.contains('focused')).toBe(false);
        });

        test('should handle format dropdown click events', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');

            const clickEvent = new Event('click', { bubbles: true });
            formatDropdown.dispatchEvent(clickEvent);

            expect(formatDropdown.classList.contains('clicked')).toBe(true);
        });

        test('should handle keyboard navigation in format dropdown', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');

            const keyDownEvent = new KeyboardEvent('keydown', {
                key: 'ArrowDown',
                bubbles: true
            });
            formatDropdown.dispatchEvent(keyDownEvent);

            expect(formatDropdown.classList.contains('keyboard-navigated')).toBe(true);
        });
    });

    describe('Format Button Validation', () => {
        test('should validate format selection', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = 'invalid-format';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            // Should not process invalid format
            expect(mockLineFormatter.setLineFormat).not.toHaveBeenCalled();
        });

        test('should handle empty format selection', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = '';

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            // Should not process empty format
            expect(mockLineFormatter.setLineFormat).not.toHaveBeenCalled();
        });

        test('should handle null format selection', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            formatDropdown.value = null;

            const changeEvent = new Event('change', { bubbles: true });
            formatDropdown.dispatchEvent(changeEvent);

            // Should not process null format
            expect(mockLineFormatter.setLineFormat).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle missing line formatter gracefully', () => {
            const editorToolbarWithoutFormatter = new EditorToolbar({
                container: mockContainer,
                stateManager: mockStateManager,
                eventManager: mockEventManager,
                lineFormatter: null
            });

            expect(() => {
                editorToolbarWithoutFormatter.createFormatButtons();
            }).not.toThrow();
        });

        test('should handle missing state manager gracefully', () => {
            const editorToolbarWithoutState = new EditorToolbar({
                container: mockContainer,
                stateManager: null,
                eventManager: mockEventManager,
                lineFormatter: mockLineFormatter
            });

            expect(() => {
                editorToolbarWithoutState.createFormatButtons();
            }).not.toThrow();
        });

        test('should handle missing event manager gracefully', () => {
            const editorToolbarWithoutEvents = new EditorToolbar({
                container: mockContainer,
                stateManager: mockStateManager,
                eventManager: null,
                lineFormatter: mockLineFormatter
            });

            expect(() => {
                editorToolbarWithoutEvents.createFormatButtons();
            }).not.toThrow();
        });

        test('should handle missing container gracefully', () => {
            const editorToolbarWithoutContainer = new EditorToolbar({
                container: null,
                stateManager: mockStateManager,
                eventManager: mockEventManager,
                lineFormatter: mockLineFormatter
            });

            expect(() => {
                editorToolbarWithoutContainer.createFormatButtons();
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should handle rapid format changes efficiently', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            const formats = ['action', 'character', 'dialogue', 'parenthetical'];

            const startTime = Date.now();

            // Rapid format changes
            for (let i = 0; i < 50; i++) {
                const format = formats[i % formats.length];
                formatDropdown.value = format;

                const changeEvent = new Event('change', { bubbles: true });
                formatDropdown.dispatchEvent(changeEvent);
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
        });

        test('should handle large number of format options efficiently', () => {
            // Create dropdown with many options
            const largeFormatDropdown = document.createElement('select');
            for (let i = 0; i < 100; i++) {
                const option = document.createElement('option');
                option.value = `format-${i}`;
                option.textContent = `Format ${i}`;
                largeFormatDropdown.appendChild(option);
            }

            mockContainer.appendChild(largeFormatDropdown);

            const startTime = Date.now();

            editorToolbar.createFormatButtons();

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
        });
    });

    describe('Accessibility', () => {
        test('should provide proper labels for format dropdown', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            expect(formatDropdown.getAttribute('aria-label')).toBe('Select format');
        });

        test('should provide proper role for format controls', () => {
            editorToolbar.createFormatButtons();

            const formatControls = mockContainer.querySelector('.format-controls');
            expect(formatControls.getAttribute('role')).toBe('group');
        });

        test('should provide keyboard navigation support', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            expect(formatDropdown.getAttribute('tabindex')).toBe('0');
        });

        test('should provide screen reader support', () => {
            editorToolbar.createFormatButtons();

            const formatDropdown = mockContainer.querySelector('.format-dropdown');
            expect(formatDropdown.getAttribute('aria-describedby')).toBeTruthy();
        });
    });
});
