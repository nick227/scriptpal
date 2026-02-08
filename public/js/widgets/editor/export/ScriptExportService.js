import { StateManager } from '../../../core/StateManager.js';

const MAX_FILENAME_LENGTH = 80;
const INVALID_FILENAME_CHARS = /[/\\?%*:|"<>]/g;

/**
 * Sanitize a string for use as a filename.
 * Reusable for import features later.
 * @param {string} title
 * @returns {string}
 */
export function sanitizeFilename (title) {
    if (typeof title !== 'string') return 'script';
    let s = title.toLowerCase().trim().replace(/\s+/g, '-').replace(INVALID_FILENAME_CHARS, '');
    if (s.length > MAX_FILENAME_LENGTH) s = s.slice(0, MAX_FILENAME_LENGTH);
    return s || 'script';
}

/**
 * Client-side script export: TXT (plain text) and JSON (raw storage).
 */
export class ScriptExportService {
    /**
     * @param {object} options
     * @param {object} options.content - Editor content with getPlainText(), getContent()
     * @param {object} options.scriptStore - getCurrentScript(), getCurrentScriptId()
     * @param {object} options.stateManager - getState(EDITOR_PREVIEW_VERSION)
     * @param {function} [options.onNotify] - (message: string) => void for "Nothing to export" etc.
     */
    constructor (options = {}) {
        if (!options.content) throw new Error('content is required');
        if (!options.scriptStore) throw new Error('scriptStore is required');
        if (!options.stateManager) throw new Error('stateManager is required');

        this.content = options.content;
        this.scriptStore = options.scriptStore;
        this.stateManager = options.stateManager;
        this.onNotify = typeof options.onNotify === 'function' ? options.onNotify : null;
    }

    _notify (message) {
        if (this.onNotify) this.onNotify(message);
        else console.warn('[ScriptExportService]', message);
    }

    _getVersion () {
        const preview = this.stateManager.getState(StateManager.KEYS.EDITOR_PREVIEW_VERSION);
        if (preview != null) return preview;
        return this.scriptStore.getCurrentScript()?.versionNumber ?? 1;
    }

    _getBaseFilename () {
        const script = this.scriptStore.getCurrentScript();
        const title = script?.title;
        return sanitizeFilename(title || 'script');
    }

    /**
     * @param {{ data: string, mime: string, filename: string }} opts
     */
    _downloadBlob ({ data, mime, filename }) {
        const blob = new Blob([data], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    exportAsTxt () {
        if (!this.scriptStore.getCurrentScriptId()) {
            this._notify('No script loaded');
            return;
        }
        const text = typeof this.content.getPlainText === 'function' ? this.content.getPlainText() : '';
        if (!text || !text.trim()) {
            this._notify('Nothing to export');
            return;
        }
        const base = this._getBaseFilename();
        const version = this._getVersion();
        const filename = `${base}_v${version}.txt`;
        this._downloadBlob({ data: text, mime: 'text/plain', filename });
    }

    exportAsJson () {
        if (!this.scriptStore.getCurrentScriptId()) {
            this._notify('No script loaded');
            return;
        }
        const raw = typeof this.content.getContent === 'function' ? this.content.getContent() : '';
        const trimmed = typeof raw === 'string' ? raw.trim() : '';
        if (!trimmed) {
            this._notify('Nothing to export');
            return;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed?.lines && Array.isArray(parsed.lines) && parsed.lines.length === 0) {
                this._notify('Nothing to export');
                return;
            }
        } catch {
            // not valid JSON; still export as-is (raw storage string)
        }
        const base = this._getBaseFilename();
        const version = this._getVersion();
        const filename = `${base}_v${version}.json`;
        this._downloadBlob({ data: trimmed, mime: 'application/json', filename });
    }
}
