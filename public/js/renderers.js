import { MESSAGE_TYPES } from './constants.js';
import { debugLog } from './core/logger.js';

/**
 *
 */
export class BaseRenderer {
    /**
     *
     * @param container
     */
    constructor (container) {
        this.container = container;
    }

    /**
     *
     */
    clear () {
        this.container.innerHTML = '';
    }

    /**
     *
     */
    scrollToBottom () {
        this.container.scrollTop = this.container.scrollHeight;
    }

    /**
     *
     */
    scrollToTop () {
        this.sleep(1000).then(() => {
            this.container.scrollTop = 0;
        });
    }

    /**
     *
     * @param ms
     */
    sleep (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     *
     * @param tag
     * @param className
     * @param content
     */
    createElement (tag, className, content = '') {
        const element = document.createElement(tag);
        element.className = className;
        if (content) {
            element.textContent = content;
        }
        return element;
    }

    /**
     *
     * @param element
     */
    appendElement (element) {
        this.container.appendChild(element);
    }

    /**
     *
     * @param element
     */
    prependElement (element) {
        this.container.insertBefore(element, this.container.firstChild);
    }

    /**
     *
     * @param className
     */
    createContainer (className) {
        return this.createElement('div', className);
    }

    /**
     *
     * @param element
     * @param className
     * @param condition
     */
    toggleClass (element, className, condition) {
        if (condition) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }
}

/**
 *
 */
export class MessageRenderer extends BaseRenderer {
    /**
     *
     * @param container
     * @param chat
     */
    constructor (container, chat) {
        super(container);
        this.chat = chat;
        this.buttonRenderer = new ModernButtonContainerRenderer(container);
    }

    /**
     *
     * @param content
     * @param type
     */
    render (content, type = MESSAGE_TYPES.USER) {
        const message = this.normalizeMessage(content, type);
        const messageDiv = this.createElement('div', `message ${message.type}`);
        messageDiv.dataset.messageId = message.id;
        messageDiv.innerHTML = message.content;
        this.prependElement(messageDiv);
        this.scrollToTop();
    }

    /**
     *
     * @param buttons
     */
    renderButtons (buttons) {
        this.buttonRenderer.render(buttons, (text) => {
            if (this.chat) {
                this.chat.handleButtonClick(text);
            }
        });
    }

    normalizeMessage (content, type) {
        if (content && typeof content === 'object') {
            return {
                id: content.id || `msg_${Date.now()}`,
                content: content.content || '',
                type: content.type || content.role || type
            };
        }

        return {
            id: `msg_${Date.now()}`,
            content: content || '',
            type
        };
    }
}

/**
 *
 */
export class ModernMessageRenderer extends BaseRenderer {
    /**
     *
     * @param container
     * @param chat
     */
    constructor (container, chat) {
        super(container);
        this.chat = chat;
        this.buttonRenderer = new ButtonContainerRenderer(container);
    }

    /**
     *
     * @param content
     * @param type
     */
    render (content, type = MESSAGE_TYPES.USER) {
        const message = this.normalizeMessage(content, type);
        const quickReplies = this.container.querySelector('.quick-replies');
        if (quickReplies) {
            quickReplies.remove();
        }
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}`;
        messageDiv.dataset.messageId = message.id;

        const avatar = message.type === MESSAGE_TYPES.USER ? 'You' : 'AI';
        const timestamp = message.timestamp || new Date().toISOString();
        const time = this.formatTime(timestamp);

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-text">${this.formatMessageContent(message.content)}</div>
                <div class="message-meta">
                    <span class="message-time">${time}</span>
                    ${message.status ? `<span class="message-status">${message.status}</span>` : ''}
                </div>
            </div>
        `;

        this.appendElement(messageDiv);
        this.scrollToBottom();
    }

    /**
     *
     * @param buttons
     */
    renderButtons (buttons) {
        this.buttonRenderer.render(buttons, (text) => {
            if (this.chat) {
                this.chat.handleButtonClick(text);
            }
        });
    }

    normalizeMessage (content, type) {
        if (content && typeof content === 'object') {
            return {
                id: content.id || `msg_${Date.now()}`,
                content: content.content || '',
                type: content.type || content.role || type,
                timestamp: content.timestamp,
                status: content.status
            };
        }

        return {
            id: `msg_${Date.now()}`,
            content: content || '',
            type,
            timestamp: new Date().toISOString()
        };
    }

    formatMessageContent (content) {
        if (!content) return '';
        let formatted = content.toString();
        formatted = formatted.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    formatTime (timestamp) {
        try {
            return new Date(timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '';
        }
    }
}

/**
 *
 */
export class ScriptRenderer extends BaseRenderer {
    /**
     *
     * @param container
     * @param onScriptSelect
     */
    constructor (container, onScriptSelect) {
        super(container);
        this.onScriptSelect = onScriptSelect;
        this.container.className = 'scripts-list-container';
    }

    /**
     *
     * @param scripts
     * @param currentScriptId
     */
    render (scripts, currentScriptId) {
        if (!scripts || !Array.isArray(scripts)) {
            console.warn('[RENDERER] Invalid scripts data for rendering');
            return;
        }

        this.clear();

        scripts.forEach(script => {
            const scriptElement = this.createScriptElement(script, currentScriptId);
            this.appendElement(scriptElement);
        });

        debugLog('[RENDERER] Rendered scripts:', {
            count: scripts.length,
            currentId: currentScriptId
        });
    }

    /**
     *
     * @param script
     * @param currentScriptId
     */
    createScriptElement (script, currentScriptId) {
        // Create container
        const container = this.createElement('li', 'script-item-container');

        // Create link
        const link = this.createElement('a', 'script-item', script.title || 'Add title');
        link.href = '#';
        link.dataset.scriptId = script.id;

        // Set active state
        this.toggleClass(link, 'active', script.id === currentScriptId);

        // Add click handler
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.onScriptSelect) {
                this.onScriptSelect(script.id);
            }
        });

        container.appendChild(link);
        return container;
    }

    /**
     *
     * @param scriptId
     */
    updateActiveScript (scriptId) {
        // Remove active class from all scripts
        const allScripts = this.container.querySelectorAll('.script-item');
        allScripts.forEach(script => script.classList.remove('active'));

        // Add active class to current script
        const activeScript = this.container.querySelector(`[data-script-id="${scriptId}"]`);
        if (activeScript) {
            activeScript.classList.add('active');
        }
    }
}

/**
 *
 */
export class ButtonElementRenderer extends BaseRenderer {
    /**
     *
     * @param button
     * @param onClick
     */
    render (button, onClick) {
        if (!button || !button.text) return null;

        const buttonElement = this.createElement('button', 'action-button', button.text);
        if (onClick) {
            buttonElement.addEventListener('click', () => onClick(button.text));
        }
        return buttonElement;
    }
}

/**
 *
 */
export class ModernButtonElementRenderer extends BaseRenderer {
    /**
     *
     * @param button
     * @param onClick
     */
    render (button, onClick) {
        if (!button || !button.text) return null;

        const buttonElement = this.createElement('button', 'quick-reply', button.text);
        buttonElement.type = 'button';
        if (onClick) {
            buttonElement.addEventListener('click', () => onClick(button.text));
        }
        return buttonElement;
    }
}

/**
 *
 */
export class ButtonContainerRenderer extends BaseRenderer {
    /**
     *
     * @param container
     */
    constructor (container) {
        super(container);
        this.buttonRenderer = new ButtonElementRenderer(container);
    }

    /**
     *
     * @param buttons
     * @param onClick
     */
    render (buttons, onClick) {
        if (!Array.isArray(buttons) || buttons.length === 0) return;

        const buttonContainer = this.createContainer('button-container');

        buttons.forEach(button => {
            const buttonElement = this.buttonRenderer.render(button, onClick);
            if (buttonElement) {
                buttonContainer.insertBefore(buttonElement, buttonContainer.firstChild);
            }
        });

        if (this.container.dataset.renderer === 'modern') {
            this.appendElement(buttonContainer);
        } else {
            this.prependElement(buttonContainer);
        }
    }
}

/**
 *
 */
export class ModernButtonContainerRenderer extends BaseRenderer {
    /**
     *
     * @param container
     */
    constructor (container) {
        super(container);
        this.buttonRenderer = new ModernButtonElementRenderer(container);
    }

    /**
     *
     * @param buttons
     * @param onClick
     */
    render (buttons, onClick) {
        if (!Array.isArray(buttons) || buttons.length === 0) return;

        const existing = this.container.querySelector('.quick-replies');
        if (existing) {
            existing.remove();
        }

        const buttonContainer = this.createContainer('quick-replies');

        buttons.forEach(button => {
            const buttonElement = this.buttonRenderer.render(button, onClick);
            if (buttonElement) {
                buttonContainer.appendChild(buttonElement);
            }
        });

        this.appendElement(buttonContainer);
        this.scrollToBottom();
    }
}

/**
 *
 */
export class EditorRenderer extends BaseRenderer {
    /**
     *
     * @param container
     * @param options
     */
    constructor (container, options = {}) {
        super(container);
        this.lineFormatter = options.lineFormatter;
        this.pageManager = options.pageManager;

        // Performance settings
        this.RENDER_BATCH_SIZE = 20;
        this.RENDER_DELAY = 16; // ~1 frame at 60fps
    }

    /**
     *
     * @param pageCount
     */
    async createPageShells (pageCount) {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < pageCount; i++) {
            const page = document.createElement('div');
            page.className = 'editor-page';
            page.dataset.pageId = `page-${i + 1}`;
            page.dataset.loaded = 'false';

            const content = document.createElement('div');
            content.className = 'editor-page-content';
            page.appendChild(content);

            fragment.appendChild(page);
        }
        this.container.appendChild(fragment);
    }

    /**
     *
     * @param lines
     * @param options
     */
    async renderContentChunk (lines, options = {}) {
        const { preserveState = false, startPage = null, skipFocus = false } = options;

        try {
            // Calculate required pages
            const requiredPages = Math.ceil(lines.length / this.pageManager.maxLinesPerPage);

            // Ensure we have enough pages
            const existingPages = typeof this.pageManager.getPages === 'function' ?
                this.pageManager.getPages() :
                this.pageManager.pages || [];
            const hasEnoughPages = existingPages.length >= requiredPages;
            const pagesReady = hasEnoughPages || await this.pageManager.waitForPages(requiredPages);
            if (!pagesReady) {
                throw new Error('Failed to ensure required pages are available');
            }

            // Always start from the first page when rendering content
            let currentPage = this.pageManager.pages[0];
            if (!currentPage) {
                throw new Error('No pages available after creation');
            }

            debugLog('[EditorRenderer] Starting content rendering:', {
                totalLines: lines.length,
                requiredPages,
                batchSize: this.RENDER_BATCH_SIZE,
                startPageId: currentPage.dataset.pageId,
                totalPages: this.pageManager.pages.length
            });

            let pageContent = currentPage.querySelector('.editor-page-content');
            if (!pageContent) {
                throw new Error('Page content container not found');
            }

            let linesInCurrentPage = 0;
            let currentPageIndex = 0;
            let firstLineElement = null;
            let fragment = document.createDocumentFragment();
            let batchSize = 0;

            // Pre-validate that we have enough pages
            if (this.pageManager.pages.length < requiredPages) {
                throw new Error(`Insufficient pages available. Need ${requiredPages}, have ${this.pageManager.pages.length}`);
            }

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineElement = this._createLineElement(line);
                if (!lineElement) continue;

                // Store first line for focus
                if (!firstLineElement) {
                    firstLineElement = lineElement;
                }

                fragment.appendChild(lineElement);
                linesInCurrentPage++;
                batchSize++;

                const isLastLine = i === lines.length - 1;
                const pageIsFull = linesInCurrentPage >= this.pageManager.maxLinesPerPage;

                if (pageIsFull || isLastLine) {
                    // Flush current page
                    pageContent.appendChild(fragment);
                    currentPage.dataset.loaded = 'true';
                    fragment = document.createDocumentFragment();

                    // If this isn't the last line, we need to move to next page
                    if (!isLastLine) {
                        currentPageIndex++;
                        // Validate next page is available
                        if (currentPageIndex >= this.pageManager.pages.length) {
                            console.error('[EditorRenderer] Page navigation failed:', {
                                currentIndex: currentPageIndex,
                                totalPages: this.pageManager.pages.length,
                                requiredPages,
                                remainingLines: lines.length - i
                            });
                            throw new Error('Page index out of bounds');
                        }

                        currentPage = this.pageManager.pages[currentPageIndex];
                        if (!currentPage) {
                            throw new Error('Next page not available');
                        }

                        pageContent = currentPage.querySelector('.editor-page-content');
                        if (!pageContent) {
                            throw new Error('Next page content container not found');
                        }

                        linesInCurrentPage = 0;
                    }
                }

                if (batchSize >= this.RENDER_BATCH_SIZE) {
                    await new Promise(resolve => setTimeout(resolve, this.RENDER_DELAY));
                    batchSize = 0;
                }
            }

            // Update page manager state
            await this.pageManager.validateState();

            // Focus first line if available
            if (!skipFocus && firstLineElement && firstLineElement.isConnected) {
                firstLineElement.focus();
            }

            debugLog('[EditorRenderer] Content rendering complete:', {
                totalPages: this.pageManager.getPageCount(),
                totalLines: lines.length,
                lastPageIndex: currentPageIndex,
                hasFirstLine: !!firstLineElement
            });

            return {
                success: true,
                firstLine: firstLineElement
            };
        } catch (error) {
            console.error('[EditorRenderer] Error in renderContentChunk:', error);
            return { success: false, error };
        }
    }

    /**
     *
     * @param line
     */
    _createLineElement (line) {
        if (!this.lineFormatter) {
            console.error('[EditorRenderer] LineFormatter not initialized');
            return null;
        }

        try {
            const format = line.format || 'action';
            const lineElement = this.lineFormatter.createFormattedLine(format);

            if (line.id) {
                lineElement.dataset.lineId = line.id;
            }

            if (line.text) {
                lineElement.textContent = line.text;
            }

            return lineElement;
        } catch (error) {
            console.error('[EditorRenderer] Error creating line element:', error);
            return null;
        }
    }

    /**
     *
     * @param line
     * @param index
     */
    async insertLine (line, index) {
        const page = this._findPageForLineIndex(index);
        if (!page) return null;

        const lineElement = this._createLineElement(line);
        const contentContainer = page.querySelector('.editor-page-content');
        const lines = Array.from(contentContainer.children);

        if (index < lines.length) {
            contentContainer.insertBefore(lineElement, lines[index]);
        } else {
            contentContainer.appendChild(lineElement);
        }

        return lineElement;
    }

    /**
     *
     * @param index
     */
    async removeLine (index) {
        const page = this._findPageForLineIndex(index);
        if (!page) return false;

        const contentContainer = page.querySelector('.editor-page-content');
        const lines = Array.from(contentContainer.children);

        if (index < lines.length) {
            contentContainer.removeChild(lines[index]);
            return true;
        }

        return false;
    }

    /**
     *
     * @param index
     * @param line
     */
    async updateLine (index, line) {
        const page = this._findPageForLineIndex(index);
        if (!page) return false;

        const contentContainer = page.querySelector('.editor-page-content');
        const lines = Array.from(contentContainer.children);

        if (index < lines.length) {
            const oldLine = lines[index];
            const newLine = this._createLineElement(line);
            contentContainer.replaceChild(newLine, oldLine);
            return true;
        }

        return false;
    }

    /**
     *
     * @param index
     */
    _findPageForLineIndex (index) {
        let currentIndex = 0;
        for (const page of this.pageManager.getPages()) {
            const contentContainer = page.querySelector('.editor-page-content');
            const lineCount = contentContainer.children.length;

            if (currentIndex + lineCount > index) {
                return page;
            }

            currentIndex += lineCount;
        }

        return null;
    }
}

/**
 *
 */
export class RendererFactory {
    /**
     *
     * @param container
     * @param chat
     */
    static createMessageRenderer (container, chat) {
        if (container && container.dataset.renderer === 'modern') {
            return new ModernMessageRenderer(container, chat);
        }
        return new MessageRenderer(container, chat);
    }

    /**
     *
     * @param container
     * @param onScriptSelect
     */
    static createScriptRenderer (container, onScriptSelect) {
        return new ScriptRenderer(container, onScriptSelect);
    }

    /**
     *
     * @param container
     */
    static createButtonContainerRenderer (container) {
        return new ButtonContainerRenderer(container);
    }

    /**
     *
     * @param container
     * @param options
     */
    static createEditorRenderer (container, options) {
        return new EditorRenderer(container, options);
    }
}
