/**
 * ScriptRenderer - Single responsibility: Render script list to DOM
 * Under 300 lines, focused on rendering only
 */
export class ScriptRenderer {
    /**
     *
     * @param container
     */
    constructor (container) {
        this.container = container;
        this.scripts = new Map();
        this.selectedScriptId = null;
    }

    /**
     * Render a script item
     * @param script
     */
    renderScript (script) {
        const scriptElement = this.createScriptElement(script);
        this.scripts.set(script.id, scriptElement);
        this.container.appendChild(scriptElement);
        return scriptElement;
    }

    /**
     * Create script DOM element
     * @param script
     */
    createScriptElement (script) {
        const scriptDiv = document.createElement('div');
        scriptDiv.className = 'script-item';
        scriptDiv.dataset.scriptId = script.id;

        const title = document.createElement('div');
        title.className = 'script-title';
        title.textContent = script.title || 'Untitled Script';

        const meta = document.createElement('div');
        meta.className = 'script-meta';
        const visibility = script.visibility || 'private';
        meta.innerHTML = `
            <span class="script-date">${this.formatDate(script.updatedAt)}</span>
            <span class="script-pages">${script.pageCount || 0} pages</span>
            <span class="script-visibility script-visibility--${visibility}">${visibility}</span>
        `;

        const actions = document.createElement('div');
        actions.className = 'script-actions';
        actions.innerHTML = `
            <button class="btn-edit" title="Edit Script">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-delete" title="Delete Script">
                <i class="fas fa-trash"></i>
            </button>
        `;

        scriptDiv.appendChild(title);
        scriptDiv.appendChild(meta);
        scriptDiv.appendChild(actions);

        // Add click handler
        scriptDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.script-actions')) {
                this.selectScript(script.id);
            }
        });

        // Add action handlers
        const editBtn = actions.querySelector('.btn-edit');
        const deleteBtn = actions.querySelector('.btn-delete');

        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.emitScriptAction('edit', script.id);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.emitScriptAction('delete', script.id);
        });

        return scriptDiv;
    }

    /**
     * Update script content
     * @param script
     */
    updateScript (script) {
        const scriptElement = this.scripts.get(script.id);
        if (scriptElement) {
            const titleElement = scriptElement.querySelector('.script-title');
            const metaElement = scriptElement.querySelector('.script-meta');

            titleElement.textContent = script.title || 'Untitled Script';
            metaElement.innerHTML = `
                <span class="script-date">${this.formatDate(script.updatedAt)}</span>
                <span class="script-pages">${script.pageCount || 0} pages</span>
            `;
        }
    }

    /**
     * Remove script from DOM
     * @param scriptId
     */
    removeScript (scriptId) {
        const scriptElement = this.scripts.get(scriptId);
        if (scriptElement) {
            scriptElement.remove();
            this.scripts.delete(scriptId);

            if (this.selectedScriptId === scriptId) {
                this.selectedScriptId = null;
            }
        }
    }

    /**
     * Select a script
     * @param scriptId
     */
    selectScript (scriptId) {
        // Remove previous selection
        if (this.selectedScriptId) {
            const prevElement = this.scripts.get(this.selectedScriptId);
            if (prevElement) {
                prevElement.classList.remove('selected');
            }
        }

        // Add new selection
        const scriptElement = this.scripts.get(scriptId);
        if (scriptElement) {
            scriptElement.classList.add('selected');
            this.selectedScriptId = scriptId;

            // Emit selection event
            this.emitScriptAction('select', scriptId);
        }
    }

    /**
     * Emit script action event
     * @param action
     * @param scriptId
     */
    emitScriptAction (action, scriptId) {
        const event = new CustomEvent('scriptAction', {
            detail: { action, scriptId }
        });
        this.container.dispatchEvent(event);
    }

    /**
     * Clear all scripts
     */
    clear () {
        this.scripts.forEach(scriptElement => scriptElement.remove());
        this.scripts.clear();
        this.selectedScriptId = null;
    }

    /**
     * Format date for display
     * @param timestamp
     */
    formatDate (timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return 'Today';
        } else if (diffDays === 2) {
            return 'Yesterday';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Get selected script ID
     */
    getSelectedScriptId () {
        return this.selectedScriptId;
    }

    /**
     * Get script element by ID
     * @param scriptId
     */
    getScriptElement (scriptId) {
        return this.scripts.get(scriptId);
    }
}
