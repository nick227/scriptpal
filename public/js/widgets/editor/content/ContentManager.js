import { BaseWidget } from '../../BaseWidget.js';

export class ContentManager extends BaseWidget {
    constructor(options) {
        super();
        this.editorArea = options.editorArea;
        this.stateManager = options.stateManager;
        this.lineFormatter = options.lineFormatter;
        this.pageManager = options.pageManager;
        this.VALID_TAGS = ['header', 'action', 'speaker', 'dialog', 'directions'];

        // Event handling
        this.eventHandlers = new Map();
        this._lastContent = '';
        this._debounceTimeout = null;

        // Store event handlers
        this.handleInput = options.handleInput;
        this.handleImport = options.handleImport;
        this.handleSelectionChange = options.handleSelectionChange;
    }

    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, new Set());
        }
        this.eventHandlers.get(eventName).add(handler);
    }

    off(eventName, handler) {
        if (handler && this.eventHandlers.has(eventName)) {
            this.eventHandlers.get(eventName).delete(handler);
        } else if (!handler) {
            this.eventHandlers.delete(eventName);
        }
    }

    emit(eventName, data) {
        if (this.eventHandlers.has(eventName)) {
            this.eventHandlers.get(eventName).forEach(handler => handler(data));
        }
    }

    async setContent(content, isHistoryOperation = false) {
        try {
            // Clear existing content first, but don't add default header if we have content
            this.clear(true); // Always skip default header since we'll handle it below

            // Ensure we have an editor area
            if (!this.editorArea) {
                console.error('ContentManager: No editor area available');
                return;
            }

            // If no content provided, create default header line
            if (!content) {
                const headerLine = this.lineFormatter.createFormattedLine('header');
                headerLine.contentEditable = 'true';
                await this.pageManager.addLine(headerLine);
                headerLine.focus();
                return;
            }

            // Try parsing as XML first
            const xmlContent = this.parseXMLContent(content);
            if (xmlContent && xmlContent.length > 0) {
                for (const line of xmlContent) {
                    const formattedLine = this.lineFormatter.createFormattedLine(line.format);
                    formattedLine.textContent = line.text;
                    await this.pageManager.addLine(formattedLine);
                }
                return;
            }

            // Fallback to legacy JSON format
            try {
                console.warn('ContentManager: Attempting to parse legacy JSON format');
                const jsonContent = typeof content === 'string' ? JSON.parse(content) : content;
                if (Array.isArray(jsonContent)) {
                    for (const line of jsonContent) {
                        if (line && line.text) {
                            const format = this.VALID_TAGS.includes(line.format) ? line.format : 'directions';
                            const formattedLine = this.lineFormatter.createFormattedLine(format);
                            formattedLine.textContent = line.text;
                            await this.pageManager.addLine(formattedLine);
                        }
                    }
                }
            } catch (e) {
                console.error('ContentManager: Failed to parse content:', e);
                // If parsing fails, create a default header line
                const headerLine = this.lineFormatter.createFormattedLine('header');
                headerLine.contentEditable = 'true';
                await this.pageManager.addLine(headerLine);
                headerLine.focus();
            }

        } catch (error) {
            console.error('ContentManager: Error setting content:', error);
            // Create a default header line on error
            const headerLine = this.lineFormatter.createFormattedLine('header');
            headerLine.contentEditable = 'true';
            await this.pageManager.addLine(headerLine);
            headerLine.focus();
            throw error;
        }
    }

    getContent() {
        if (!this.editorArea) return '';

        try {
            const lines = [];
            this.pageManager.getPages().forEach(page => {
                const contentContainer = page.querySelector('.editor-page-content');
                if (!contentContainer) {
                    console.warn('ContentManager: No content container found in page');
                    return;
                }
                Array.from(contentContainer.children).forEach(line => {
                    if (!line.classList.contains('script-line')) return;

                    // Extract format from class name (format-xyz)
                    const formatClass = Array.from(line.classList).find(cls => cls.startsWith('format-'));
                    const format = formatClass ? formatClass.replace('format-', '') : 'action';

                    const text = line.textContent.trim();
                    if (text) {
                        lines.push(`<${format}>${text}</${format}>`);
                    }
                });
            });
            return lines.join('\n');
        } catch (error) {
            console.error('ContentManager: Error getting content:', error);
            return '';
        }
    }

    destroy() {
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
        }
        super.destroy();
    }

    debouncedContentUpdate() {
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
        }
        this._debounceTimeout = setTimeout(() => {
            const content = this.getContent();
            if (content !== this._lastContent) {
                this._lastContent = content;
                this.emit('contentChanged', content);
            }
        }, 300);
    }

    clear(skipDefaultHeader = false) {
        // Remove all pages except the first one
        const pages = this.pageManager.getPages();
        while (pages.length > 1) {
            pages[pages.length - 1].remove();
            pages.pop();
        }

        // Clear the first page's content
        if (pages.length > 0) {
            const contentContainer = pages[0].querySelector('.editor-page-content');
            if (contentContainer) {
                while (contentContainer.firstChild) {
                    contentContainer.removeChild(contentContainer.firstChild);
                }
            }
        }

        // Only add default header if not skipped
        if (!skipDefaultHeader) {
            const headerLine = this.lineFormatter.createFormattedLine('header');
            this.pageManager.addLine(headerLine);
        }
    }

    setLineFormat(format) {
        if (!this.editorArea || !this.lineFormatter) {
            console.error('ContentManager: Cannot set format - missing editor area or line formatter');
            return;
        }

        // Get current line from state manager
        const currentLine = this.stateManager.getCurrentLine();
        if (!currentLine) {
            console.warn('ContentManager: No current line selected');
            return;
        }

        try {
            // Apply new format
            this.lineFormatter.setLineFormat(currentLine, format);

            // Update state
            this.stateManager.setCurrentFormat(format);

            // Trigger content update
            this.debouncedContentUpdate();
        } catch (error) {
            console.error('ContentManager: Error setting line format:', error);
        }
    }

    parseXMLContent(content) {
        if (typeof content !== 'string') return null;

        const lines = [];
        const xmlRegex = /<(header|action|speaker|dialog|directions)>(.*?)<\/\1>/g;
        let match;

        while ((match = xmlRegex.exec(content)) !== null) {
            const [_, format, text] = match;
            if (this.VALID_TAGS.includes(format)) {
                lines.push({ format, text: text.trim() });
            }
        }

        return lines;
    }
}