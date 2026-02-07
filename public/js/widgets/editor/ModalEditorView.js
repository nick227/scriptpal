import { mountOutlineCreator } from '../outline/OutlineCreatorComponent.js';

export class ModalEditorView {
    constructor (options = {}) {
        this.adapter = options.adapter;
        this.modal = null;
        this.form = null;
        this.onSave = null;
        this.onAiGenerate = null;
        this.currentItemId = null;
        this.aiButton = null;
        this.outlineComponents = {};
        this.buildModal();
    }

    buildModal () {
        if (!this.adapter || !this.adapter.view) {
            throw new Error('Modal editor adapter not found');
        }
        const { classNames, labels, fields } = this.adapter.view;
        const hasAiGenerate = fields.some((f) => f.aiGenerate);
        const aiGenerateRow = hasAiGenerate
            ? `<div class="${classNames.aiRow}"><button type="button" data-action="ai-generate">${labels.aiGenerate}</button></div>`
            : '';
        this.modal = document.createElement('div');
        this.modal.className = `${classNames.modal} ${classNames.hidden}`;
        this.modal.innerHTML = `
            <div class="${classNames.backdrop}"></div>
            <div class="${classNames.content}">
                <header class="${classNames.header}">
                    <h3 class="${classNames.title}">${labels.title}</h3>
                </header>
                <form class="${classNames.form}">
                    ${aiGenerateRow}
                    ${fields.map(field => this.renderField(field, classNames, labels)).join('')}
                    <div class="${classNames.actions}">
                        <button type="button" class="${classNames.close}" data-action="close">${labels.close}</button>
                        <button type="submit" class="${classNames.save}">${labels.save}</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.form = this.modal.querySelector(`.${classNames.form}`);
        this.aiButton = this.modal.querySelector('[data-action="ai-generate"]');
        this.mountOutlineFields();

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
        let inputHtml;
        if (field.type === 'outline') {
            inputHtml = `
                <div class="outline-creator-wrap">
                    <div class="outline-creator" data-outline-field="${field.name}"></div>
                    <input type="hidden" name="${field.name}" value="[]" />
                </div>
            `;
        } else if (field.type === 'textarea') {
            inputHtml = `<textarea name="${field.name}" rows="${field.rows || 3}"></textarea>`;
        } else {
            inputHtml = `<input name="${field.name}" type="${field.inputType || 'text'}" ${required} ${placeholder} />`;
        }

        return `
            <label>
                <span>${labelText}</span>
                ${inputHtml}
            </label>
        `;
    }

    mountOutlineFields () {
        const { fields } = this.adapter.view;
        fields.filter((f) => f.type === 'outline').forEach((field) => {
            const container = this.form.querySelector(`.outline-creator[data-outline-field="${field.name}"]`);
            const hiddenInput = this.form.querySelector(`input[name="${field.name}"]`);
            if (container && hiddenInput) {
                this.outlineComponents[field.name] = mountOutlineCreator(container, {
                    hiddenInput,
                    onReady: (api) => {
                        this.outlineComponents[field.name] = api;
                    }
                });
            }
        });
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
        const outline = this.outlineComponents[name];
        if (outline) {
            outline.setValue(Array.isArray(value) ? value : []);
            const hidden = this.form.querySelector(`input[name="${name}"]`);
            if (hidden) hidden.value = JSON.stringify(outline.getValue());
            return;
        }
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
