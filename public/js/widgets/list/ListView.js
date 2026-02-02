export class ListView {
    constructor (options = {}) {
        this.container = options.container || null;
        this.adapter = options.adapter;
        this.onAction = options.onAction || null;
        this.getDragItemId = options.getDragItemId || null;
        this.getEditingItemId = options.getEditingItemId || null;
        this.gridContainer = null;
        this.modal = null;
        this.modalGrid = null;
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
        this.buildModal();
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
                <div class="${classNames.modalGrid}"></div>
            </div>
        `;
        document.body.appendChild(this.modal);
        this.modalGrid = this.modal.querySelector(`.${classNames.modalGrid}`);
        this.modalGrid.addEventListener('click', this.handleGridClick);
        this.modalGrid.addEventListener('dragstart', this.handleDragStart);
        this.modalGrid.addEventListener('dragover', this.handleDragOver);
        this.modalGrid.addEventListener('drop', this.handleDrop);
        this.modalGrid.addEventListener('dragend', this.handleDragEnd);

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
        this.renderContainer(this.gridContainer, items);
        this.renderContainer(this.modalGrid, items, true);
        this.focusInlineEditor(this.gridContainer);
        this.focusInlineEditor(this.modalGrid);
    }

    renderContainer (container, items, isModal = false) {
        if (!container) {
            return;
        }
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
            const tile = this.createItemTile(item);
            container.appendChild(tile);
        });
    }

    createItemTile (item) {
        const { labels, classNames, dataKey, supportsMedia } = this.adapter.view;
        const tile = this.createElement('div', classNames.tile);
        tile.dataset[dataKey] = this.adapter.getId(item);
        tile.draggable = true;

        const title = this.createElement('div', classNames.tileTitle);
        title.dataset.action = 'rename';
        const editingItemId = this.getEditingItemId ? this.getEditingItemId() : null;
        if (editingItemId && String(editingItemId) === String(this.adapter.getId(item))) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = classNames.tileTitleInput;
            input.value = this.adapter.getTitle(item);
            input.dataset.action = 'rename-input';
            title.appendChild(input);
        } else {
            title.textContent = this.adapter.getTitle(item);
        }

        const meta = this.createElement('div', classNames.tileMeta, this.adapter.getMetaText(item));

        const actions = this.createElement('div', classNames.tileActions);
        const mediaButton = supportsMedia
            ? `<button type="button" data-action="media" title="${labels.media}">${labels.media}</button>`
            : '';
        actions.innerHTML = `
            ${mediaButton}
            <button type="button" data-action="edit" title="${labels.edit}">${labels.edit}</button>
            <button class="${classNames.iconButton}" type="button" data-action="delete" title="${labels.delete}">${labels.deleteText}</button>
        `;

        tile.appendChild(title);
        tile.appendChild(meta);
        tile.appendChild(actions);

        return tile;
    }

    handleGridClick (event) {
        const { classNames, dataKey } = this.adapter.view;
        const { target } = event;
        const { action } = target.dataset;
        if (!action) {
            return;
        }
        const tile = target.closest(`.${classNames.tile}`);
        if (!tile) {
            return;
        }
        const itemId = tile.dataset[dataKey];
        if (action === 'edit') {
            this.emitAction('edit', { itemId });
        }
        if (action === 'delete') {
            this.emitAction('delete', { itemId });
        }
        if (action === 'rename') {
            this.emitAction('rename', { itemId });
        }
        if (action === 'media') {
            this.emitAction('media', {
                itemId,
                ownerType: this.adapter.view.ownerType,
                role: this.adapter.view.mediaRole
            });
        }
    }

    focusInlineEditor (container) {
        const { classNames, dataKey } = this.adapter.view;
        const editingItemId = this.getEditingItemId ? this.getEditingItemId() : null;
        if (!container || !editingItemId) {
            return;
        }
        const selector = `[data-${this.getDataAttributeName(dataKey)}="${editingItemId}"] .${classNames.tileTitleInput}`;
        const input = container.querySelector(selector);
        if (input) {
            input.focus();
            input.select();
            input.addEventListener('blur', () => {
                this.emitAction('commit-rename', { itemId: editingItemId, value: input.value });
            }, { once: true });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.emitAction('commit-rename', { itemId: editingItemId, value: input.value });
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.emitAction('cancel-rename');
                }
            }, { once: true });
        }
    }

    handleDragStart (event) {
        const { classNames } = this.adapter.view;
        const tile = event.target.closest(`.${classNames.tile}`);
        if (!tile) {
            return;
        }
        this.emitAction('drag-start', { itemId: this.getItemIdFromTile(tile) });
        tile.classList.add(classNames.dragging);
        event.dataTransfer.effectAllowed = 'move';
    }

    handleDragOver (event) {
        const { classNames } = this.adapter.view;
        const tile = event.target.closest(`.${classNames.tile}`);
        const dragItemId = this.getDragItemId ? this.getDragItemId() : null;
        if (!tile || !dragItemId) {
            return;
        }
        event.preventDefault();
    }

    handleDrop (event) {
        const { classNames } = this.adapter.view;
        const tile = event.target.closest(`.${classNames.tile}`);
        const dragItemId = this.getDragItemId ? this.getDragItemId() : null;
        if (!tile || !dragItemId) {
            return;
        }
        event.preventDefault();
        const targetId = this.getItemIdFromTile(tile);
        if (String(targetId) === String(dragItemId)) {
            return;
        }
        this.emitAction('drop', { sourceId: dragItemId, targetId });
    }

    handleDragEnd (event) {
        const { classNames } = this.adapter.view;
        const tile = event.target.closest(`.${classNames.tile}`);
        if (tile) {
            tile.classList.remove(classNames.dragging);
        }
        this.emitAction('drag-end');
    }

    getItemIdFromTile (tile) {
        const { dataKey } = this.adapter.view;
        return tile.dataset[dataKey];
    }

    getDataAttributeName (dataKey) {
        return dataKey.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
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
