import { ListModalView } from './ListModalView.js';

export class ListView {
    constructor (options = {}) {
        this.container = options.container || null;
        this.adapter = options.adapter;
        this.onAction = options.onAction || null;
        this.getDragItemId = options.getDragItemId || null;
        this.getEditingItemId = options.getEditingItemId || null;
        this.allowDropToEnd = options.allowDropToEnd ?? true;
        this.gridContainer = null;
        this.modalView = null;
        this.handleGridClick = this.handleGridClick.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
    }

    initialize () {
        if (!this.container) {
            throw new Error('List container element not found');
        }
        if (!this.adapter || !this.adapter.view) {
            throw new Error('List view adapter not found');
        }
        this.container.innerHTML = '';
        this.buildPanel();
        this.buildModalView();
    }

    setActionHandler (handler) {
        this.onAction = handler;
    }

    emitAction (type, payload = {}) {
        if (!this.onAction) {
            return;
        }
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
        this.gridContainer.addEventListener('dragstart', this.handleDragStart);
        this.gridContainer.addEventListener('dragover', this.handleDragOver);
        this.gridContainer.addEventListener('drop', this.handleDrop);
        this.gridContainer.addEventListener('dragend', this.handleDragEnd);

        this.container.appendChild(header);
        this.container.appendChild(this.gridContainer);
    }

    buildModalView () {
        this.modalView = new ListModalView({
            adapter: this.adapter,
            onAdd: () => this.emitAction('add'),
            onGridClick: this.handleGridClick,
            onDragStart: this.handleDragStart,
            onDragOver: this.handleDragOver,
            onDrop: this.handleDrop,
            onDragEnd: this.handleDragEnd
        });
        this.modalView.initialize();
    }

    openModal () {
        if (this.modalView) {
            this.modalView.open();
        }
    }

    closeModal () {
        if (this.modalView) {
            this.modalView.close();
        }
    }

    destroy () {
        if (this.gridContainer) {
            this.gridContainer.removeEventListener('click', this.handleGridClick);
            this.gridContainer.removeEventListener('dragstart', this.handleDragStart);
            this.gridContainer.removeEventListener('dragover', this.handleDragOver);
            this.gridContainer.removeEventListener('drop', this.handleDrop);
            this.gridContainer.removeEventListener('dragend', this.handleDragEnd);
        }
        if (this.modalView) {
            this.modalView.destroy();
        }
        this.gridContainer = null;
        this.modalView = null;
    }

    render (items, options = {}) {
        const { panel = true, modal = true } = options;
        if (panel) {
            this.renderContainer(this.gridContainer, items, false);
            this.focusInlineEditor(this.gridContainer);
        }
        if (modal && this.modalView) {
            this.modalView.render(items, this.renderContainer.bind(this), this.focusInlineEditor.bind(this));
        }
    }

    renderContainer (container, items, isModal = false) {
        if (!container) {
            return;
        }
        const { labels, classNames, dataKey } = this.adapter.view;
        const previousScrollTop = container.scrollTop;
        container.style.setProperty('--cols', Math.min(items.length, 6));
        if (isModal) {
            container.classList.toggle(classNames.modalGridFew, items.length <= 3);
        }
        if (items.length === 0) {
            const empty = this.createElement('div', classNames.empty, labels.empty);
            container.replaceChildren(empty);
            return;
        }

        const existingTiles = new Map();
        container.querySelectorAll(this.getTileSelector()).forEach(tile => {
            existingTiles.set(String(tile.dataset[dataKey]), tile);
        });

        const nextChildren = [];
        items.forEach(item => {
            const itemId = String(this.adapter.getId(item));
            const existingTile = existingTiles.get(itemId);
            if (existingTile) {
                this.updateItemTile(existingTile, item, isModal);
                nextChildren.push(existingTile);
                existingTiles.delete(itemId);
                return;
            }
            nextChildren.push(this.createItemTile(item, isModal));
        });

        container.replaceChildren(...nextChildren);
        container.scrollTop = previousScrollTop;
    }

    createItemTile (item, isModal = false) {
        const { classNames, dataKey } = this.adapter.view;
        const tile = this.createElement('div', classNames.tile);
        tile.dataset[dataKey] = this.adapter.getId(item);
        tile.draggable = true;

        const title = this.createElement('div', classNames.tileTitle);
        this.applyTitleContent(title, item);

        const meta = this.createElement('div', classNames.tileMeta);
        this.applyMetaContent(meta, item);
        const mediaThumbs = this.buildMediaThumbs(item);

        const actions = this.createElement('div', classNames.tileActions);
        this.applyActionsContent(actions);

        tile.appendChild(title);
        tile.appendChild(meta);
        if (mediaThumbs) {
            tile.appendChild(mediaThumbs);
        }
        this.syncPanelDeleteLink(tile, isModal, actions);
        tile.appendChild(actions);

        return tile;
    }

    updateItemTile (tile, item, isModal = false) {
        const { classNames, dataKey } = this.adapter.view;
        tile.className = classNames.tile;
        tile.dataset[dataKey] = this.adapter.getId(item);
        tile.draggable = true;

        const title = tile.querySelector(`.${classNames.tileTitle}`);
        const meta = tile.querySelector(`.${classNames.tileMeta}`);
        const mediaThumbs = tile.querySelector('.list-tile__thumbs');
        const actions = tile.querySelector(`.${classNames.tileActions}`);

        if (title) {
            this.applyTitleContent(title, item);
        }

        if (meta) {
            this.applyMetaContent(meta, item);
        }

        this.syncMediaThumbs(tile, mediaThumbs, item, actions);

        if (actions) {
            this.applyActionsContent(actions);
        }

        this.syncPanelDeleteLink(tile, isModal, actions);
    }

    syncMediaThumbs (tile, existingThumbs, item, actions) {
        const nextThumbs = this.buildMediaThumbs(item);
        if (!existingThumbs && !nextThumbs) {
            return;
        }
        if (existingThumbs && !nextThumbs) {
            existingThumbs.remove();
            return;
        }
        if (!existingThumbs && nextThumbs) {
            if (actions && actions.parentNode === tile) {
                tile.insertBefore(nextThumbs, actions);
            } else {
                tile.appendChild(nextThumbs);
            }
            return;
        }
        if (existingThumbs && nextThumbs) {
            existingThumbs.replaceChildren(...nextThumbs.childNodes);
        }
    }

    applyTitleContent (title, item) {
        const { classNames } = this.adapter.view;
        title.replaceChildren();
        title.dataset.action = 'rename';
        const editingItemId = this.getEditingItemId ? this.getEditingItemId() : null;
        if (editingItemId && String(editingItemId) === String(this.adapter.getId(item))) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = classNames.tileTitleInput;
            input.value = this.adapter.getTitle(item);
            input.dataset.action = 'rename-input';
            title.appendChild(input);
            return;
        }
        title.textContent = this.adapter.getTitle(item);
    }

    applyMetaContent (meta, item) {
        const metaContent = this.adapter.getMetaText(item) ?? '';
        if (this.adapter.view.metaAsHtml) {
            meta.innerHTML = this.sanitizeMetaHtml(metaContent);
            return;
        }
        meta.textContent = metaContent;
    }

    applyActionsContent (actions) {
        const { labels, classNames, supportsMedia } = this.adapter.view;
        const mediaButton = supportsMedia
            ? `<button type="button" data-action="media" title="${labels.media}">${labels.media}</button>`
            : '';
        actions.innerHTML = `
            ${mediaButton}
            <button type="button" data-action="edit" title="${labels.edit}">${labels.edit}</button>
            <button class="${classNames.iconButton}" type="button" data-action="delete" title="${labels.delete}">${labels.deleteText}</button>
        `;
    }

    buildMediaThumbs (item) {
        const thumbs = this.extractMediaThumbs(item);
        if (!thumbs.length) {
            return null;
        }
        const wrapper = this.createElement('div', 'list-tile__thumbs');
        thumbs.slice(0, 4).forEach((thumb, index) => {
            const card = this.createElement('div', 'list-tile__thumb-card');
            const img = document.createElement('img');
            img.className = 'list-tile__thumb';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = thumb.url;
            img.alt = `${this.adapter.getTitle(item)} media ${index + 1}`;
            card.appendChild(img);
            if (thumb.attachmentId) {
                const remove = this.createElement('button', 'list-tile__thumb-remove', 'x');
                remove.type = 'button';
                remove.dataset.action = 'remove-media';
                remove.dataset.attachmentId = String(thumb.attachmentId);
                if (thumb.assetId) {
                    remove.dataset.assetId = String(thumb.assetId);
                }
                remove.title = 'Remove media';
                card.appendChild(remove);
            }
            wrapper.appendChild(card);
        });
        return wrapper;
    }

    extractMediaThumbs (item) {
        const candidates = [];
        const appendThumb = (value, attachmentId = null, assetId = null) => {
            if (!value || typeof value !== 'string') {
                return;
            }
            const trimmed = value.trim();
            if (!trimmed) {
                return;
            }
            let normalizedUrl = trimmed;
            if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('data:image/')) {
                normalizedUrl = trimmed;
            } else {
                normalizedUrl = `/uploads/${trimmed}`;
            }
            candidates.push({
                url: normalizedUrl,
                attachmentId: attachmentId ? String(attachmentId) : null,
                assetId: assetId ? String(assetId) : null
            });
        };

        const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
        if (attachments.length > 0) {
            attachments.forEach((attachment) => {
                const attachmentId = attachment?.id;
                const asset = attachment?.asset || {};
                const assetId = asset?.id;
                const variants = Array.isArray(asset?.variants) ? asset.variants : [];
                const preview = variants.find((variant) => variant.kind === 'preview') || variants[0];
                const preferredUrl = preview?.url
                    || (preview?.storageKey ? `/uploads/${preview.storageKey}` : '')
                    || asset?.thumbnailUrl
                    || asset?.url
                    || (asset?.storageKey ? `/uploads/${asset.storageKey}` : '')
                    || attachment?.thumbnailUrl
                    || attachment?.previewUrl
                    || attachment?.url;
                appendThumb(preferredUrl, attachmentId, assetId);
            });
            return candidates.filter((thumb, index, list) => (
                thumb.url && list.findIndex(other => String(other.attachmentId) === String(thumb.attachmentId)) === index
            ));
        }

        appendThumb(item?.coverUrl);
        appendThumb(item?.thumbnailUrl);
        appendThumb(item?.thumbnail);
        appendThumb(item?.mediaUrl);

        const mediaList = Array.isArray(item?.media) ? item.media : [];
        mediaList.forEach((mediaEntry) => {
            appendThumb(mediaEntry?.url);
            appendThumb(mediaEntry?.previewUrl);
            appendThumb(mediaEntry?.thumbnailUrl);
            appendThumb(mediaEntry?.storageKey);
            const variants = Array.isArray(mediaEntry?.variants) ? mediaEntry.variants : [];
            const preview = variants.find((variant) => variant.kind === 'preview') || variants[0];
            appendThumb(preview?.url);
            appendThumb(preview?.storageKey);
        });

        const unique = [];
        const seen = new Set();
        candidates.forEach((thumb) => {
            const dedupeKey = `${thumb.url}::${thumb.attachmentId || ''}::${thumb.assetId || ''}`;
            if (seen.has(dedupeKey)) {
                return;
            }
            seen.add(dedupeKey);
            unique.push(thumb);
        });
        return unique;
    }

    syncPanelDeleteLink (tile, isModal, actions) {
        const { labels } = this.adapter.view;
        const existingPanelDeleteLink = tile.querySelector('a.list-tile__delete-link[data-action="delete"]');
        if (!isModal && !existingPanelDeleteLink) {
            const panelDeleteLink = this.createElement('a', 'list-tile__delete-link');
            panelDeleteLink.href = '#';
            panelDeleteLink.dataset.action = 'delete';
            panelDeleteLink.textContent = labels.delete.toLowerCase();
            if (actions && actions.parentNode === tile) {
                tile.insertBefore(panelDeleteLink, actions);
            } else {
                tile.appendChild(panelDeleteLink);
            }
            return;
        }
        if (isModal && existingPanelDeleteLink) {
            existingPanelDeleteLink.remove();
        }
    }

    handleGridClick (event) {
        const { dataKey } = this.adapter.view;
        const { target } = event;
        const { action } = target.dataset;
        if (!action) {
            return;
        }
        if (action === 'delete' && target.closest('a')) {
            event.preventDefault();
        }
        const tile = target.closest(this.getTileSelector());
        if (!tile) {
            return;
        }
        const itemId = tile.dataset[dataKey];
        switch (action) {
        case 'edit':
            this.emitAction('edit', { itemId });
            break;
        case 'delete':
            this.emitAction('delete', { itemId });
            break;
        case 'rename':
            this.emitAction('rename', { itemId });
            break;
        case 'media':
            this.emitAction('media', {
                itemId,
                ownerType: this.adapter.view.ownerType,
                role: this.adapter.view.mediaRole
            });
            break;
        case 'remove-media':
            this.emitAction('remove-media', {
                itemId,
                ownerType: this.adapter.view.ownerType,
                attachmentId: target.dataset.attachmentId || null,
                assetId: target.dataset.assetId || null
            });
            break;
        default:
            break;
        }
    }

    focusInlineEditor (container) {
        const { classNames, dataKey } = this.adapter.view;
        const editingItemId = this.getEditingItemId ? this.getEditingItemId() : null;
        if (!container || !editingItemId) {
            return;
        }
        const tiles = Array.from(container.querySelectorAll(this.getTileSelector()));
        const tile = tiles.find((currentTile) => String(currentTile.dataset[dataKey]) === String(editingItemId));
        const input = tile ? tile.querySelector(`.${classNames.tileTitleInput}`) : null;
        if (input) {
            input.focus();
            input.select();
            if (input.dataset.inlineListenersBound === 'true') {
                return;
            }
            input.dataset.inlineListenersBound = 'true';
            let handled = false;
            const finalize = (type, payload = {}) => {
                if (handled) {
                    return;
                }
                handled = true;
                this.emitAction(type, payload);
            };
            input.addEventListener('blur', () => {
                finalize('commit-rename', { itemId: editingItemId, value: input.value });
            }, { once: true });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    finalize('commit-rename', { itemId: editingItemId, value: input.value });
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    finalize('cancel-rename');
                }
            });
        }
    }

    handleDragStart (event) {
        const { classNames } = this.adapter.view;
        const tile = event.target.closest(this.getTileSelector());
        if (!tile) {
            return;
        }
        if (event.target.closest('button, a, input, textarea, select, label')) {
            event.preventDefault();
            return;
        }
        this.emitAction('drag-start', { itemId: this.getItemIdFromTile(tile) });
        tile.classList.add(classNames.dragging);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this.getItemIdFromTile(tile));
    }

    handleDragOver (event) {
        const dragItemId = this.getDragItemId ? this.getDragItemId() : null;
        if (!dragItemId) {
            return;
        }
        const tile = event.target.closest(this.getTileSelector());
        const container = event.currentTarget;
        if (!tile && event.target !== container) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    handleDrop (event) {
        const tile = event.target.closest(this.getTileSelector());
        const container = event.currentTarget;
        const dragItemId = this.getDragItemId ? this.getDragItemId() : null;
        if (!dragItemId) {
            return;
        }
        event.preventDefault();
        const targetId = tile
            ? this.getItemIdFromTile(tile)
            : (this.allowDropToEnd ? this.getLastDropTargetId(container, dragItemId) : null);
        if (!targetId) {
            return;
        }
        if (String(targetId) === String(dragItemId)) {
            return;
        }
        this.emitAction('drop', { sourceId: dragItemId, targetId });
    }

    handleDragEnd (event) {
        const { classNames } = this.adapter.view;
        const tile = event.target.closest(this.getTileSelector());
        if (tile) {
            tile.classList.remove(classNames.dragging);
        }
        this.emitAction('drag-end');
    }

    getItemIdFromTile (tile) {
        const { dataKey } = this.adapter.view;
        return tile.dataset[dataKey];
    }

    getLastDropTargetId (container, dragItemId) {
        if (!container) {
            return null;
        }
        const tiles = Array.from(container.querySelectorAll(this.getTileSelector()));
        const targets = tiles
            .map(tile => this.getItemIdFromTile(tile))
            .filter(itemId => String(itemId) !== String(dragItemId));
        return targets.length ? targets[targets.length - 1] : null;
    }

    getTileSelector () {
        const tileClass = this.adapter?.view?.classNames?.tile || '';
        const primaryClass = tileClass.split(/\s+/).find(Boolean);
        return primaryClass ? `.${primaryClass}` : '.list-tile';
    }

    sanitizeMetaHtml (html) {
        const template = document.createElement('template');
        template.innerHTML = String(html ?? '');
        // Keep a narrow content-only allowlist; no links/attributes to reduce XSS surface.
        const allowedTags = new Set(['UL', 'OL', 'LI', 'P', 'BR', 'STRONG', 'EM', 'B', 'I']);

        const nodes = Array.from(template.content.querySelectorAll('*'));
        nodes.forEach(node => {
            if (!allowedTags.has(node.tagName)) {
                const textNode = document.createTextNode(node.textContent || '');
                node.replaceWith(textNode);
                return;
            }
            while (node.attributes.length > 0) {
                node.removeAttribute(node.attributes[0].name);
            }
        });

        return template.innerHTML;
    }

    createElement (tag, className, textContent) {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (textContent !== undefined) {
            element.textContent = textContent;
        }
        return element;
    }
}
