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
    }

    async initialize () {
        if (!this.container) {
            console.warn('[PublicScriptsWidget] Container not found');
            return;
        }

        this.listContainer = this.container.querySelector('.public-scripts-list');
        this.sortControl = this.container.querySelector('.public-scripts-sort');
        this.refreshButton = this.container.querySelector('.public-scripts-refresh');
        this.metaLabel = this.container.querySelector('.public-scripts-meta');

        if (!this.listContainer) {
            console.warn('[PublicScriptsWidget] List container is missing');
            return;
        }

        this.sortControl?.addEventListener('change', () => {
            this.sortBy = this.sortControl?.value || 'updatedAt';
            this.order = this.sortBy === 'title' ? 'asc' : 'desc';
            this.loadPublicScripts({ reset: true });
        });

        this.refreshButton?.addEventListener('click', () => this.loadPublicScripts({ reset: true }));

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
        console.log(script);
        const card = document.createElement('article');
        card.className = 'public-script-card';
        card.dataset.scriptId = script.id;

        const header = document.createElement('div');
        header.className = 'public-script-card__header';

        const thumb = document.createElement('img');
        thumb.className = 'public-script-card__thumb';
        thumb.alt = 'Script cover';
        thumb.loading = 'lazy';
        thumb.src = script.coverUrl || '/images/screenplay-thumb.svg';

        const titleLink = document.createElement('a');
        titleLink.className = 'public-script-card__title';
        titleLink.textContent = script.title || 'Untitled Script';
        const slugCandidate = script.canonicalSlug || script.slug;
        const slug = slugCandidate ? encodeURIComponent(slugCandidate) : '';
        const publicId = script.publicId ? encodeURIComponent(script.publicId) : '';
        const hasPrettyUrl = publicId && slug;
        titleLink.href = hasPrettyUrl
            ? `/public/${publicId}/${slug}`
            : publicId
                ? `/public/${publicId}`
                : `public-script.html?id=${encodeURIComponent(script.id || '')}`;
        titleLink.rel = 'noopener noreferrer';

        const meta = document.createElement('div');
        meta.className = 'public-script-card__meta';

        const descriptionSpan = document.createElement('span');
        descriptionSpan.className = 'public-script-card__description';
        descriptionSpan.textContent = script.description || 'No description';

        const authorSpan = document.createElement('span');
        authorSpan.textContent = script.author || 'Unknown author';

        const versionSpan = document.createElement('span');
        versionSpan.textContent = `Version ${script.versionNumber || 1}`;

        const dateSpan = document.createElement('span');
        dateSpan.textContent = this.formatDate(script.updatedAt);

        const tagsSpan = document.createElement('span');
        tagsSpan.className = 'public-script-card__tags';
        const tagValues = Array.isArray(script.tags)
            ? script.tags
                .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
                .filter(Boolean)
            : [];
        tagsSpan.textContent = tagValues.length
            ? `Tags: ${tagValues.join(', ')}`
            : 'Tags: none';

        meta.append(authorSpan, versionSpan, dateSpan, tagsSpan);

        // header.appendChild(thumb);
        header.appendChild(titleLink);
        card.appendChild(header);
        card.appendChild(descriptionSpan);
        card.appendChild(meta);

        return card;
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
