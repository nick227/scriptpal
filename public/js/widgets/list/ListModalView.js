export class ListModalView {
    constructor (options = {}) {
        this.adapter = options.adapter;
        this.onAdd = options.onAdd || null;
        this.onGridClick = options.onGridClick || null;
        this.onDragStart = options.onDragStart || null;
        this.onDragOver = options.onDragOver || null;
        this.onDrop = options.onDrop || null;
        this.onDragEnd = options.onDragEnd || null;
        this.modal = null;
        this.gridContainer = null;
        this.gridListeners = [];
        this.handleModalClick = this.handleModalClick.bind(this);
    }

    initialize () {
        if (!this.adapter || !this.adapter.view) {
            throw new Error('List modal adapter not found');
        }
        const { labels, classNames } = this.adapter.view;
        this.modal = document.createElement('div');
        this.modal.className = `${classNames.modal} ${classNames.modalHidden}`;
        this.modal.innerHTML = `
            <div class="${classNames.modalBackdrop}"></div>
            <div class="${classNames.modalContent}">
                <header class="${classNames.modalHeader}">
                    <h3>${labels.modalTitle}</h3>
                </header>
                <div class="${classNames.modalGrid}"></div>
                <footer>
                    <div class="${classNames.modalControls}">
                        <button type="button" class="${classNames.panelButton}" data-action="add">${labels.add}</button>
                        <button type="button" class="${classNames.panelButton}" data-action="close">${labels.close}</button>
                    </div>
                </footer>
            </div>
        `;
        document.body.appendChild(this.modal);
        this.gridContainer = this.modal.querySelector(`.${classNames.modalGrid}`);

        this.gridListeners = [
            ['click', this.onGridClick],
            ['dragstart', this.onDragStart],
            ['dragover', this.onDragOver],
            ['drop', this.onDrop],
            ['dragend', this.onDragEnd]
        ];
        this.gridListeners.forEach(([type, handler]) => {
            if (handler) {
                this.gridContainer.addEventListener(type, handler);
            }
        });
        this.modal.addEventListener('click', this.handleModalClick);
    }

    open () {
        const { classNames } = this.adapter.view;
        if (this.modal) {
            this.modal.classList.remove(classNames.modalHidden);
        }
    }

    close () {
        const { classNames } = this.adapter.view;
        if (this.modal) {
            this.modal.classList.add(classNames.modalHidden);
        }
    }

    render (items, renderContainer, focusInlineEditor) {
        if (!this.gridContainer || typeof renderContainer !== 'function') {
            return;
        }
        renderContainer(this.gridContainer, items, true);
        if (typeof focusInlineEditor === 'function') {
            focusInlineEditor(this.gridContainer);
        }
    }

    destroy () {
        if (this.gridContainer) {
            this.gridListeners.forEach(([type, handler]) => {
                if (handler) {
                    this.gridContainer.removeEventListener(type, handler);
                }
            });
        }
        if (this.modal) {
            this.modal.removeEventListener('click', this.handleModalClick);
            this.modal.remove();
        }
        this.gridListeners = [];
        this.gridContainer = null;
        this.modal = null;
    }

    handleModalClick (event) {
        const { classNames } = this.adapter.view;
        const { target } = event;
        const { action } = target.dataset;
        if (action === 'close' || target.classList.contains(classNames.modalBackdrop)) {
            this.close();
        } else if (action === 'add' && this.onAdd) {
            this.onAdd();
        }
    }
}
