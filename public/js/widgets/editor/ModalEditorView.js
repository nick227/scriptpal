export class ModalEditorView {
    constructor (options = {}) {
        this.adapter = options.adapter;
        this.modal = null;
        this.form = null;
        this.onSave = null;
        this.onAiGenerate = null;
        this.currentItemId = null;
        this.aiButton = null;
        this.buildModal();
    }

    buildModal () {
        if (!this.adapter || !this.adapter.view) {
            throw new Error('Modal editor adapter not found');
        }
        const { classNames, labels, fields } = this.adapter.view;
        this.modal = document.createElement('div');
        this.modal.className = `${classNames.modal} ${classNames.hidden}`;
        this.modal.innerHTML = `
            <div class="${classNames.backdrop}"></div>
            <div class="${classNames.content}">
                <header class="${classNames.header}">
                    <h3 class="${classNames.title}">${labels.title}</h3>
                    <button type="button" class="${classNames.close}" data-action="close">${labels.close}</button>
                </header>
                <form class="${classNames.form}">
                    ${fields.map(field => this.renderField(field, classNames, labels)).join('')}
                    <div class="${classNames.actions}">
                        <button type="submit" class="${classNames.save}">${labels.save}</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.form = this.modal.querySelector(`.${classNames.form}`);
        this.aiButton = this.modal.querySelector('[data-action="ai-generate"]');

        this.modal.addEventListener('click', (event) => {
            const { target } = event;
            const { action } = target.dataset;
            if (action === 'close' || target.classList.contains(classNames.backdrop)) {
                this.close();
            }
            if (action === 'ai-generate') {
                event.preventDefault();
                if (this.onAiGenerate) {
                    this.onAiGenerate();
                }
            }
        });

        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!this.onSave) {
                return;
            }
            this.onSave(this.currentItemId, this.getFormPayload());
        });
    }

    renderField (field, classNames, labels) {
        const labelText = field.label || '';
        const required = field.required ? 'required' : '';
        const placeholder = field.placeholder ? `placeholder="${field.placeholder}"` : '';
        const inputHtml = field.type === 'textarea'
            ? `<textarea name="${field.name}" rows="${field.rows || 3}"></textarea>`
            : `<input name="${field.name}" type="${field.inputType || 'text'}" ${required} ${placeholder} />`;

        if (field.aiGenerate) {
            return `
                <label>
                    <span>${labelText}</span>
                    <div class="${classNames.row}">
                        ${inputHtml}
                        <button type="button" data-action="ai-generate">${labels.aiGenerate}</button>
                    </div>
                </label>
            `;
        }

        return `
            <label>
                <span>${labelText}</span>
                ${inputHtml}
            </label>
        `;
    }

    setHandlers ({ onSave, onAiGenerate }) {
        this.onSave = onSave;
        this.onAiGenerate = onAiGenerate;
        if (this.aiButton) {
            this.aiButton.disabled = !this.onAiGenerate;
        }
    }

    setAiDisabled (isDisabled) {
        if (this.aiButton) {
            this.aiButton.disabled = isDisabled;
        }
    }

    getFormPayload () {
        return this.adapter.buildPayload(new FormData(this.form));
    }

    getCurrentItemId () {
        return this.currentItemId;
    }

    setFieldValue (name, value) {
        const field = this.form.querySelector(`[name="${name}"]`);
        if (field) {
            field.value = value;
        }
    }

    open (item, handlers) {
        this.setHandlers(handlers);
        this.currentItemId = item.id;
        const values = this.adapter.getFieldValues(item);
        Object.entries(values).forEach(([name, value]) => {
            this.setFieldValue(name, value);
        });
        this.modal.classList.remove(this.adapter.view.classNames.hidden);
    }

    close () {
        this.modal.classList.add(this.adapter.view.classNames.hidden);
        this.onSave = null;
        this.onAiGenerate = null;
        this.currentItemId = null;
        this.form.reset();
    }
}
