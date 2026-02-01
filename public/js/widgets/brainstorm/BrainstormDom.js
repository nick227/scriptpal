export class BrainstormDom {
    constructor (rootSelector = '.brainstorm-widget') {
        this.root = document.querySelector(rootSelector);
        if (!this.root) {
            throw new Error('Brainstorm root element not found');
        }

        this.form = this.root.querySelector('.brainstorm-seed-form');
        this.input = this.root.querySelector('.brainstorm-seed-input');
        this.seedButton = this.root.querySelector('.brainstorm-seed-button');
        this.actions = Array.from(this.root.querySelectorAll('.brainstorm-action'));
        this.board = this.root.querySelector('.brainstorm-board');
        this.status = this.root.querySelector('.brainstorm-status');
        this.boardSelect = this.root.querySelector('.brainstorm-board-select');
        this.newBoardButton = this.root.querySelector('.brainstorm-board-new');
        this.deleteBoardButton = this.root.querySelector('.brainstorm-board-delete');
        this.titleInput = this.root.querySelector('.brainstorm-title-input');
        this.columns = new Map();
        this.columnInputs = new Map();
        this.columnButtons = new Map();
        this.root.querySelectorAll('.brainstorm-column').forEach((column) => {
            const { category } = column.dataset;
            const notes = column.querySelector('.brainstorm-column__notes');
            const input = column.querySelector('.brainstorm-column__input');
            const button = column.querySelector('.brainstorm-column__button');
            if (category && notes) {
                this.columns.set(category, notes);
            }
            if (category && input) {
                this.columnInputs.set(category, input);
            }
            if (category && button) {
                this.columnButtons.set(category, button);
            }
        });

        if (!this.form || !this.input || !this.seedButton || !this.board || !this.status || !this.columns.size
            || !this.boardSelect || !this.newBoardButton || !this.titleInput || !this.deleteBoardButton) {
            throw new Error('Brainstorm UI elements missing');
        }
    }

    bindSeedSubmit (handler) {
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            handler(this.input.value.trim());
        });
    }

    bindSeedInputChange (handler) {
        this.input.addEventListener('input', () => {
            handler(this.input.value.trim());
        });
    }

    bindActionClicks (handler) {
        this.actions.forEach((button) => {
            button.addEventListener('click', () => {
                handler(button.dataset.category);
            });
        });
    }

    bindBoardSelect (handler) {
        this.boardSelect.addEventListener('change', () => {
            handler(this.boardSelect.value);
        });
    }

    bindNewBoard (handler) {
        this.newBoardButton.addEventListener('click', () => {
            handler();
        });
    }

    bindTitleChange (handler) {
        this.titleInput.addEventListener('change', () => {
            handler(this.titleInput.value.trim());
        });
    }

    bindAddCard (handler) {
        this.columnButtons.forEach((button, category) => {
            button.addEventListener('click', () => {
                const input = this.columnInputs.get(category);
                const value = input ? input.value.trim() : '';
                handler(category, value);
                if (input) {
                    input.value = '';
                }
            });
        });
        this.columnInputs.forEach((input, category) => {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const value = input.value.trim();
                    handler(category, value);
                    input.value = '';
                }
            });
        });
    }

    bindDeleteCard (handler) {
        this.columns.forEach((container) => {
            container.addEventListener('click', (event) => {
                const { target } = event;
                if (!target || !target.classList.contains('brainstorm-note__delete')) {
                    return;
                }
                const noteElement = target.closest('.brainstorm-note');
                if (!noteElement) {
                    return;
                }
                const { noteId, category } = noteElement.dataset;
                handler(noteId, category);
            });
        });
    }

    bindDeleteBoard (handler) {
        if (!this.deleteBoardButton) {
            return;
        }
        this.deleteBoardButton.addEventListener('click', () => {
            handler();
        });
    }

    setSeedInputValue (seedValue) {
        this.input.value = seedValue;
    }

    setBoardTitle (title) {
        this.titleInput.value = title;
    }

    setSeedButtonEnabled (enabled) {
        if (!this.seedButton) {
            return;
        }
        this.seedButton.disabled = !enabled;
    }

    setDeleteBoardEnabled (enabled) {
        if (!this.deleteBoardButton) {
            return;
        }
        this.deleteBoardButton.disabled = !enabled;
        if (enabled) {
            this.deleteBoardButton.classList.remove('is-disabled');
            this.deleteBoardButton.setAttribute('aria-disabled', 'false');
        } else {
            this.deleteBoardButton.classList.add('is-disabled');
            this.deleteBoardButton.setAttribute('aria-disabled', 'true');
        }
    }

    setNewBoardEnabled (enabled) {
        if (!this.newBoardButton) {
            return;
        }
        this.newBoardButton.disabled = !enabled;
        if (enabled) {
            this.newBoardButton.classList.remove('is-disabled');
            this.newBoardButton.setAttribute('aria-disabled', 'false');
        } else {
            this.newBoardButton.classList.add('is-disabled');
            this.newBoardButton.setAttribute('aria-disabled', 'true');
        }
    }

    setBoardOptions (boards, selectedId) {
        this.boardSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a board';
        if (!selectedId) {
            placeholder.selected = true;
        }
        this.boardSelect.appendChild(placeholder);
        boards.forEach((board) => {
            const option = document.createElement('option');
            option.value = String(board.id);
            const label = board.title || board.seed || `Board ${board.id}`;
            option.textContent = label;
            if (String(board.id) === String(selectedId)) {
                option.selected = true;
            }
            this.boardSelect.appendChild(option);
        });
    }

    setActionsEnabled (enabled) {
        this.actions.forEach((button) => {
            button.disabled = !enabled;
        });
    }

    setAllActionsLoading (isLoading, hasSeed, activeCategory = null) {
        this.actions.forEach((button) => {
            const { category } = button.dataset;
            const isActive = activeCategory ? category === activeCategory : false;
            if (isLoading && !isActive) {
                button.disabled = true;
                button.classList.add('is-loading');
                button.setAttribute('aria-busy', 'true');
            } else if (!isLoading) {
                button.classList.remove('is-loading');
                button.setAttribute('aria-busy', 'false');
                button.disabled = !hasSeed;
            }
        });
    }

    setActionLoading (categoryKey, isLoading, hasSeed) {
        const button = this.actions.find((target) => target.dataset.category === categoryKey);
        if (!button) {
            return;
        }
        if (isLoading) {
            if (!button.dataset.originalLabel) {
                button.dataset.originalLabel = button.textContent;
            }
            button.textContent = 'Loading...';
        } else if (button.dataset.originalLabel) {
            button.textContent = button.dataset.originalLabel;
            delete button.dataset.originalLabel;
        }
        button.classList.toggle('is-loading', isLoading);
        button.disabled = isLoading || !hasSeed;
        button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }

    clearNotes () {
        this.columns.forEach((container) => {
            container.innerHTML = '';
        });
    }

    showStatusMessage (message) {
        this.status.textContent = message;
        this.status.classList.add('is-visible');
    }

    clearStatusMessage () {
        this.status.textContent = '';
        this.status.classList.remove('is-visible');
    }

    removeNoteElement (noteId) {
        if (!noteId) {
            return;
        }
        const element = this.root.querySelector(`.brainstorm-note[data-note-id="${noteId}"]`);
        if (element) {
            element.remove();
        }
    }

    createNoteElement (note) {
        const element = document.createElement('div');
        element.className = `brainstorm-note brainstorm-note--${note.category}`;
        const text = document.createElement('span');
        text.className = 'brainstorm-note__text';
        text.textContent = note.text;
        const remove = document.createElement('button');
        remove.className = 'brainstorm-note__delete';
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Delete note');
        element.appendChild(text);
        element.appendChild(remove);
        element.dataset.noteId = note.id;
        element.dataset.category = note.category;
        return element;
    }

    addNoteElement (element, categoryKey) {
        const category = categoryKey || element.dataset.category;
        const container = category ? this.columns.get(category) : null;
        if (container) {
            container.appendChild(element);
        }
    }

    revealNote (element) {
        window.requestAnimationFrame(() => {
            element.classList.add('is-visible');
        });
    }

    addNoteToCategory (element, category) {
        this.addNoteElement(element, category);
    }
}
