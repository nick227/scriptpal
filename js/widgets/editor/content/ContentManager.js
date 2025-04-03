import { BaseWidget } from '../../BaseWidget.js';
import { EventManager } from '../../../core/EventManager.js';

export class ContentManager extends BaseWidget {
    constructor(options) {
        super();
        console.log('ContentManager: Constructing with options:', options);
        this.editorArea = options.editorArea;
        if (!this.editorArea) {
            console.error('ContentManager: No editor area provided!');
        }
        console.log('ContentManager: Editor area set:', this.editorArea);
        this.stateManager = options.stateManager;
        this.lineFormatter = options.lineFormatter;
        this.pageManager = options.pageManager;
        this._lastContent = '';
        this._debounceTimeout = null;
        this._eventManager = new EventManager();

        // Store event handlers
        this.handleKeydown = options.handleKeydown;
        this.handleInput = options.handleInput;
        this.handlePaste = options.handlePaste;
        this.handleSelectionChange = options.handleSelectionChange;
    }

    async setContent(content, isHistoryOperation = false) {
        console.log('ContentManager: Setting content:', content);

        // Clear existing content
        this.clear();

        // Handle empty or null content
        if (!content) {
            const initialLine = this.lineFormatter.createFormattedLine('header');
            await this.pageManager.addLine(initialLine);
            return;
        }

        let contentStr;

        // Parse content if it's a JSON string
        if (typeof content === 'string') {
            try {
                // Try to parse if it looks like JSON
                if (content.trim().startsWith('{')) {
                    const parsed = JSON.parse(content);
                    contentStr = parsed.content;
                } else {
                    contentStr = content;
                }
            } catch (e) {
                console.log('ContentManager: Not a JSON string, using as is');
                contentStr = content;
            }
        } else if (typeof content === 'object' && content.content !== undefined) {
            contentStr = content.content;
        }

        // Handle empty content after parsing
        if (!contentStr || (typeof contentStr === 'string' && !contentStr.trim())) {
            const initialLine = this.lineFormatter.createFormattedLine('header');
            await this.pageManager.addLine(initialLine);
            return;
        }

        // Split content into lines and create formatted lines
        const lines = contentStr.split('\n').filter(line => line.trim());
        console.log('ContentManager: Processing lines:', lines);

        // If no valid lines, create initial header
        if (lines.length === 0) {
            const initialLine = this.lineFormatter.createFormattedLine('header');
            await this.pageManager.addLine(initialLine);
            return;
        }

        // Process lines sequentially to maintain order
        for (const lineContent of lines) {
            const format = this.getFormatFromLine(lineContent) || 'header';
            const line = this.lineFormatter.createFormattedLine(format);
            line.textContent = this.stripFormatMarkers(lineContent);
            await this.pageManager.addLine(line);
        }

        // Update state if not a history operation
        if (!isHistoryOperation) {
            this._lastContent = contentStr;
            this.emit('CHANGE', this._lastContent);
        }
    }

    getFormatFromLine(line) {
        const formatMatch = line.match(/\[(\w+)\](.*?)\[\/\1\]/);
        return formatMatch ? formatMatch[1].toLowerCase() : null;
    }

    stripFormatMarkers(line) {
        return line.replace(/\[(\w+)\](.*?)\[\/\1\]/, '$2');
    }

    getContent() {
        console.log('ContentManager: getContent called, editorArea:', this.editorArea);
        if (!this.editorArea) {
            console.error('ContentManager: Cannot get content - no editor area!');
            return '';
        }

        // First find all editor pages
        const pages = this.editorArea.querySelectorAll('.editor-page');
        console.log('ContentManager: Found pages:', pages);

        // Then find all script lines within those pages
        const lines = Array.from(this.editorArea.querySelectorAll('.editor-page .script-line'));
        console.log('ContentManager: Getting content from lines:', lines);

        if (lines.length === 0) {
            console.warn('ContentManager: No script lines found in editor area');
            // Log the current DOM structure to help debug
            console.log('ContentManager: Current editor area structure:', this.editorArea.innerHTML);
            return '';
        }

        const formattedContent = lines.map(line => {
            const format = line.getAttribute('data-format');
            if (!format) {
                console.warn('ContentManager: Line missing format attribute:', line);
                return '';
            }
            const text = line.textContent.trim();
            const formatted = `[${format.toUpperCase()}]${text}[/${format.toUpperCase()}]`;
            console.log('ContentManager: Formatted line:', { format, text, formatted });
            return formatted;
        }).join('\n');

        console.log('ContentManager: Final formatted content:', formattedContent);
        return formattedContent;
    }

    setLineFormat(format) {

        if (!this.lineFormatter || !this.stateManager) {
            console.warn('ContentManager: Missing formatter or state manager');
            return;
        }

        const currentLine = this.stateManager.getCurrentLine();
        if (!currentLine) {
            console.warn('ContentManager: No current line to format');
            return;
        }

        // Format the current line
        this.lineFormatter.setLineFormat(currentLine, format);

        // Update state and emit events
        this.stateManager.setCurrentFormat(format);
        this.emit('FORMAT_CHANGE', format);
    }

    clear() {
        while (this.editorArea.firstChild) {
            this.editorArea.removeChild(this.editorArea.firstChild);
        }
        this.stateManager.setCurrentLine(null);
        this._lastContent = '';
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
            this._debounceTimeout = null;
        }
    }

    debouncedContentUpdate() {
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
        }

        this._debounceTimeout = setTimeout(() => {
            const content = this.getContent();
            if (content !== this._lastContent) {
                this._lastContent = content;
                // Emit both local and EditorContent events
                this.emit('CHANGE', content);
                if (this.editorArea) {
                    const editorContent = this.editorArea.closest('.editor-content');
                    if (editorContent && editorContent.dispatchEvent) {
                        const event = new CustomEvent('EDITOR:CHANGE', { detail: content });
                        editorContent.dispatchEvent(event);
                    }
                }
            }
        }, 3000); // 3 second debounce
    }

    emit(eventType, data) {
        this._eventManager.publish(eventType, data);
    }

    on(eventType, handler) {
        return this._eventManager.subscribe(eventType, handler, this);
    }

    off(eventType) {
        this._eventManager.unsubscribeAll(this);
    }

    destroy() {
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
            this._debounceTimeout = null;
        }
        this._eventManager.unsubscribeAll(this);
        super.destroy();
    }
}