/**
 * PublicScriptsWidget - renders the public scripts feed and viewer
 */
export class PublicScriptsWidget {
    constructor ({ api }) {
        if (!api) {
            throw new Error('API client is required for PublicScriptsWidget');
        }
        this.api = api;
        this.container = document.querySelector('.public-scripts-panel');
        this.listContainer = null;
        this.viewerContainer = null;
        this.sortControl = null;
        this.refreshButton = null;
        this.loadMoreButton = null;
        this.metaLabel = null;
        this.publicScripts = [];
        this.currentPage = 0;
        this.totalPages = 0;
        this.pageSize = 0;
        this.totalScripts = 0;
        this.sortBy = 'updatedAt';
        this.order = 'desc';
        this.isLoading = false;
        this.selectedScriptId = null;
    }

    async initialize () {
        if (!this.container) {
            console.warn('[PublicScriptsWidget] Container not found');
            return;
        }

        this.listContainer = this.container.querySelector('.public-scripts-list');
        this.viewerContainer = this.container.querySelector('.public-script-viewer');
        this.sortControl = this.container.querySelector('.public-scripts-sort');
        this.refreshButton = this.container.querySelector('.public-scripts-refresh');
        this.loadMoreButton = this.container.querySelector('.public-scripts-load-more');
        this.metaLabel = this.container.querySelector('.public-scripts-meta');

        if (!this.listContainer || !this.viewerContainer) {
            console.warn('[PublicScriptsWidget] List or viewer container is missing');
            return;
        }

        this.sortControl?.addEventListener('change', () => {
            this.sortBy = this.sortControl?.value || 'updatedAt';
            this.order = this.sortBy === 'title' ? 'asc' : 'desc';
            this.loadPublicScripts({ reset: true });
        });

        this.refreshButton?.addEventListener('click', () => this.loadPublicScripts({ reset: true }));
        this.loadMoreButton?.addEventListener('click', () => this.loadPublicScripts());

        this.listContainer.innerHTML = '<div class="public-scripts-loading">Loading public scripts...</div>';

        await this.loadPublicScripts({ reset: true });
    }

    async loadPublicScripts ({ reset = false } = {}) {
        if (this.isLoading) {
            return;
        }

        this.isLoading = true;
        const nextPage = reset ? 1 : this.currentPage + 1;

        try {
            const response = await this.api.getPublicScripts({
                page: nextPage,
                pageSize: 9,
                sortBy: this.sortBy,
                order: this.order
            });

            if (reset) {
                this.publicScripts = response.scripts || [];
                this.selectedScriptId = null;
            } else {
                this.publicScripts = [
                    ...this.publicScripts,
                    ...(response.scripts || [])
                ];
            }

            const meta = response.meta || {};
            this.currentPage = meta.page || nextPage;
            this.pageSize = meta.pageSize || this.pageSize || 9;
            this.totalPages = meta.totalPages || this.totalPages || 1;
            this.totalScripts = meta.total || this.totalScripts || this.publicScripts.length;

            this.renderList();
            this.updateMeta();
            this.updateLoadMoreState();
        } catch (error) {
            console.error('[PublicScriptsWidget] Failed to load scripts:', error);
            if (this.listContainer) {
                this.listContainer.innerHTML = '<div class="public-script-error">Unable to load public scripts right now.</div>';
            }
        } finally {
            this.isLoading = false;
        }
    }

    renderList () {
        if (!this.listContainer) return;

        this.listContainer.innerHTML = '';

        if (!this.publicScripts || this.publicScripts.length === 0) {
            this.listContainer.innerHTML = '<div class="public-scripts-loading">No public scripts available yet.</div>';
            return;
        }

        this.publicScripts.forEach(script => {
            const card = this.createScriptCard(script);
            this.listContainer.appendChild(card);
        });
    }

    createScriptCard (script) {
        const card = document.createElement('div');
        card.className = 'public-script-card';
        card.dataset.scriptId = script.id;

        const header = document.createElement('div');
        header.className = 'public-script-card__header';

        const title = document.createElement('h3');
        title.textContent = script.title || 'Untitled Script';

        const badge = document.createElement('span');
        badge.className = `public-script-badge public-script-badge--${script.visibility || 'private'}`;
        badge.textContent = (script.visibility || 'private').toUpperCase();

        header.appendChild(title);
        header.appendChild(badge);
        card.appendChild(header);

        const summary = document.createElement('p');
        summary.className = 'public-script-card__summary';
        summary.textContent = script.summary || 'No preview available.';
        card.appendChild(summary);

        const meta = document.createElement('div');
        meta.className = 'public-script-meta';
        meta.innerHTML = `
            <span>By ${script.author || 'Unknown'}</span>
            <span>v${script.versionNumber || 1}</span>
            <span>${this.formatDate(script.updatedAt)}</span>
        `;
        card.appendChild(meta);

        const action = document.createElement('button');
        action.className = 'public-script-card__action';
        action.type = 'button';
        action.textContent = 'View read-only';
        action.addEventListener('click', (event) => {
            event.stopPropagation();
            this.handleCardSelect(script.id);
        });

        card.appendChild(action);

        card.addEventListener('click', () => this.handleCardSelect(script.id));

        return card;
    }

    async handleCardSelect (scriptId) {
        if (!scriptId || !this.viewerContainer) return;
        if (this.selectedScriptId === scriptId) {
            return;
        }

        this.selectedScriptId = scriptId;
        this.viewerContainer.innerHTML = '<div class="public-scripts-loading">Loading script preview...</div>';

        try {
            const script = await this.api.getPublicScript(scriptId);
            if (!script) {
                this.viewerContainer.innerHTML = '<div class="public-script-error">Script details unavailable.</div>';
                return;
            }
            this.renderViewer(script);
        } catch (error) {
            console.error('[PublicScriptsWidget] Failed to load script:', error);
            this.viewerContainer.innerHTML = '<div class="public-script-error">Unable to load script preview.</div>';
        }
    }

    renderViewer (script) {
        if (!this.viewerContainer) return;

        const ownerEmail = script.owner?.email ? ` (${script.owner.email})` : '';
        this.viewerContainer.innerHTML = `
            <h3 class="public-script-viewer__title">${script.title || 'Untitled Script'}</h3>
            <div class="public-script-viewer__metadata">
                <span>${script.author || 'Unknown author'}</span>
                <span>v${script.versionNumber || 1}</span>
                <span>${this.formatDate(script.updatedAt)}</span>
                <span>Owner ID: ${script.owner?.id || 'N/A'}${ownerEmail}</span>
            </div>
            <div class="public-script-viewer__content">${this.escapeHtml(script.content)}</div>
        `;
    }

    escapeHtml (value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    updateMeta () {
        if (!this.metaLabel) return;
        this.metaLabel.textContent = `Showing ${this.publicScripts.length} of ${this.totalScripts} public scripts`;
    }

    updateLoadMoreState () {
        if (!this.loadMoreButton) return;
        const moreAvailable = this.currentPage < this.totalPages;
        this.loadMoreButton.disabled = !moreAvailable;
        this.loadMoreButton.textContent = moreAvailable
            ? 'Load more public scripts'
            : 'No more scripts';
    }

    formatDate (value) {
        if (!value) return 'Unknown date';
        const date = new Date(value);
        const now = Date.now();
        const diff = Math.round((now - date.getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    }
}
