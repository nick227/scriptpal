/**
 * Editor constants
 * Centralized constants for the editor widget
 */

// Page layout constants
export const MAX_LINES_PER_PAGE = 22;
export const MAX_OVERFLOW = 0;
export const PAGE_MARGIN = 30;
export const PAGE_HEIGHT = 1056;
export const CONTENT_HEIGHT = PAGE_HEIGHT - (PAGE_MARGIN * 2);

// Line height constants
export const LINE_HEIGHT = 22; // Standard line height in pixels

// Import centralized format constants
import { VALID_FORMATS as formatTypes } from '../../constants/formats.js';

// Re-export for backward compatibility
export { formatTypes };

// Editor events
export const EDITOR_EVENTS = {
    CONTENT_CHANGE: 'contentChange',
    CONTENT_UPDATED: 'contentUpdated',
    CONTENT_PERSIST: 'contentPersist',
    AUTOCOMPLETE_SUGGESTIONS: 'autocompleteSuggestions',
    AUTOCOMPLETE_CURRENT: 'autocompleteCurrent',
    CURSOR_MOVE: 'cursorMove',
    FORMAT_CHANGE: 'formatChange',
    FOCUS_OUT: 'focusOut',
    UNDO: 'undo',
    REDO: 'redo',
    EDITOR_AREA_READY: 'editorAreaReady',
    LINE_ADDED: 'lineAdded',
    PAGE_UNDO: 'pageUndo',
    PAGE_REDO: 'pageRedo',
    PAGE_CHANGED: 'pageChanged',
    PAGE_BREAK_INSERTED: 'pageBreakInserted',
    PAGE_BREAK_REMOVED: 'pageBreakRemoved',
    PAGE_BREAK_CLICKED: 'pageBreakClicked'
};

export const PAGE_STYLES = {
    width: '8.5in',
    height: '11in',
    minHeight: `${PAGE_HEIGHT}px`,
    padding: `${PAGE_MARGIN}px`
};
