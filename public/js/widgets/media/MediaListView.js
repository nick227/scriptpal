/**
 * MediaListView - Specialized view for displaying media in a grid
 * Extends the standard list view pattern with media-specific rendering
 * Supports images and will support other media types in the future
 */
export class MediaListView {
    constructor (options = {}) {
        this.container = options.container || null;
        this.adapter = options.adapter;
        this.onAction = options.onAction || null;
        this.gridContainer = null;
        this.modal = null;
        this.modalGrid = null;
        this.handleGridClick = this.handleGridClick.bind(this);
    }

    initialize () {
        if (!this.container) {
            throw new Error('Media list container element not found');
        }
        if (!this.adapter || !this.adapter.view) {
            throw new Error('Media list view adapter not found');
        }
        this.container.innerHTML = '';
        this.buildPanel();
        this.buildModal();
    }

    setActionHandler (handler) {
        this.onAction = handler;
    }

    emitAction (type, payload = {}) {
        if (!this.onAction) return;
        this.onAction({ type, payload });
    }

    buildPanel () {
        const { labels, classNames } = this.adapter.view;
        const header = this.createElement('div', classNames.panelHeader);
        const title = this.createElement('h3', classNames.panelTitle, labels.title);

        const addButton = this.createElement('button', classNames.panelButton, labels.add);
        addButton.type = 'button';
        addButton.addEventListener('click', () => this.emitAction('add'));

        const expandButton = this.createElement('button', classNames.panelButton, labels.fullscreen);
        expandButton.type = 'button';
        expandButton.addEventListener('click', () => this.openModal());

        const controls = this.createElement('div', classNames.panelControls);
        controls.appendChild(addButton);
        controls.appendChild(expandButton);

        header.appendChild(title);
        header.appendChild(controls);

        this.gridContainer = this.createElement('div', classNames.grid);
        this.gridContainer.addEventListener('click', this.handleGridClick);

        this.container.appendChild(header);
        this.container.appendChild(this.gridContainer);
    }

    buildModal () {
        const { labels, classNames } = this.adapter.view;
        this.modal = document.createElement('div');
        this.modal.className = `${classNames.modal} ${classNames.modalHidden}`;
        this.modal.innerHTML = `
            <div class="${classNames.modalBackdrop}"></div>
            <div class="${classNames.modalContent}">
                <header class="${classNames.modalHeader}">
                    <h3>${labels.modalTitle}</h3>
                    <div class="${classNames.modalControls}">
                        <button type="button" class="${classNames.panelButton}" data-action="add">${labels.add}</button>
                        <button type="button" class="${classNames.panelButton}" data-action="close">${labels.close}</button>
                    </div>
                </header>
                <div class="${classNames.modalGrid} media-modal-grid"></div>
            </div>
        `;
        document.body.appendChild(this.modal);
        this.modalGrid = this.modal.querySelector(`.${classNames.modalGrid}`);
        this.modalGrid.addEventListener('click', this.handleGridClick);

        this.modal.addEventListener('click', (event) => {
            const { target } = event;
            const { action } = target.dataset;
            if (action === 'close' || target.classList.contains(classNames.modalBackdrop)) {
                this.closeModal();
            }
            if (action === 'add') {
                this.emitAction('add');
            }
        });
    }

    openModal () {
        const { classNames } = this.adapter.view;
        this.modal.classList.remove(classNames.modalHidden);
    }

    closeModal () {
        const { classNames } = this.adapter.view;
        this.modal.classList.add(classNames.modalHidden);
    }

    render (items) {
        this.renderContainer(this.gridContainer, items, false);
        this.renderContainer(this.modalGrid, items, true);
    }

    renderContainer (container, items, isModal = false) {
        if (!container) return;
        const { labels, classNames } = this.adapter.view;
        container.innerHTML = '';
        container.style.setProperty('--cols', Math.min(items.length, 6));
        if (isModal) {
            container.classList.toggle(classNames.modalGridFew, items.length <= 3);
        }
        if (items.length === 0) {
            const empty = this.createElement('div', classNames.empty, labels.empty);
            container.appendChild(empty);
            return;
        }
        items.forEach(item => {
            const tile = this.createMediaTile(item, isModal);
            container.appendChild(tile);
        });
    }

    createMediaTile (item, isModal = false) {
        const { labels, classNames, dataKey } = this.adapter.view;
        const tile = this.createElement('div', classNames.tile);
        tile.dataset[dataKey] = this.adapter.getId(item);

        const mediaUrl = this.adapter.getMediaUrl(item);
        const mediaType = this.adapter.getMediaType(item);
        const mediaContainer = this.createElement('div', classNames.tileMedia);
        
        if (mediaUrl) {
            if (mediaType === 'image' || mediaType.startsWith('image')) {
                const img = document.createElement('img');
                img.src = mediaUrl;
                img.alt = this.adapter.getTitle(item);
                img.loading = 'lazy';
                mediaContainer.appendChild(img);
            } else if (mediaType === 'video' || mediaType.startsWith('video')) {
                const video = document.createElement('video');
                video.src = mediaUrl;
                video.muted = true;
                video.preload = 'metadata';
                mediaContainer.appendChild(video);
            } else {
                mediaContainer.textContent = mediaType.toUpperCase();
                mediaContainer.classList.add('is-file');
            }
        } else {
            mediaContainer.textContent = 'No preview';
        }

        const actions = this.createElement('div', classNames.tileActions);
        actions.innerHTML = `
            <button type="button" data-action="view" title="View">${labels.edit}</button>
            <button class="${classNames.iconButton}" type="button" data-action="delete" title="${labels.delete}">${labels.deleteText}</button>
        `;

        tile.appendChild(mediaContainer);
        if (isModal) {
            const title = this.createElement('div', classNames.tileTitle, this.adapter.getTitle(item));
            tile.appendChild(title);
        }
        tile.appendChild(actions);

        return tile;
    }

    handleGridClick (event) {
        const { classNames, dataKey } = this.adapter.view;
        const { target } = event;
        const { action } = target.dataset;
        if (!action) return;
        const tile = target.closest(`.${classNames.tile}`);
        if (!tile) return;
        const itemId = tile.dataset[dataKey];
        if (action === 'view') {
            this.emitAction('view', { itemId });
        }
        if (action === 'delete') {
            this.emitAction('delete', { itemId });
        }
    }

    getItemIdFromTile (tile) {
        const { dataKey } = this.adapter.view;
        return tile.dataset[dataKey];
    }

    createElement (tag, className, textContent) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent !== undefined) element.textContent = textContent;
        return element;
    }
}
