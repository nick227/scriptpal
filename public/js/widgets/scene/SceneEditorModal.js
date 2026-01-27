import { BaseWidget } from '../BaseWidget.js';

/**
 *
 */
export class SceneEditorModal extends BaseWidget {
    /**
     *
     */
    constructor () {
        super();
        this.modal = null;
        this.form = null;
        this.onSave = null;
        this.onAiGenerate = null;
        this.currentSceneId = null;
        this.aiButton = null;
        this.buildModal();
    }

    /**
     *
     */
    buildModal () {
        this.modal = document.createElement('div');
        this.modal.className = 'scene-editor-modal hidden';
        this.modal.innerHTML = `
            <div class="scene-editor-modal__backdrop"></div>
            <div class="scene-editor-modal__content">
                <header class="scene-editor-modal__header">
                    <h3 class="scene-editor-modal__title">Scene</h3>
                    <button type="button" class="scene-editor-modal__close" data-action="close">cancel</button>
                </header>
                <form class="scene-editor-modal__form">
                    <label>
                        <span>Title</span>
                        <div class="row">
                        <input name="title" type="text" required />
                        <button type="button" data-action="ai-generate">ai generate</button>
                        </div>
                    </label>
                    <label>
                        <span>Description</span>
                        <textarea name="description" rows="3"></textarea>
                    </label>
                    <label>
                        <span>Notes</span>
                        <textarea name="notes" rows="3"></textarea>
                    </label>
                    <label>
                        <span>Tags</span>
                        <input name="tags" type="text" placeholder="tag1, tag2" />
                    </label>
                    <div class="scene-editor-modal__actions">
                        <button type="submit" class="scene-editor-modal__save">Save</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.form = this.modal.querySelector('.scene-editor-modal__form');
        this.aiButton = this.modal.querySelector('[data-action="ai-generate"]');

        this.modal.addEventListener('click', (event) => {
            const action = event.target.dataset.action;
            if (action === 'close' || event.target.classList.contains('scene-editor-modal__backdrop')) {
                this.close();
            }
            if (action === 'ai-generate') {
                event.preventDefault();
                this.onAiGenerateScene();
            }
        });

        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!this.onSave) {
                return;
            }
            this.onSave(this.currentSceneId, this.getFormPayload());
        });
    }

    /**
     *
     */
    getFormPayload () {
        const data = new FormData(this.form);
        return {
            title: String(data.get('title')).trim(),
            description: String(data.get('description')),
            notes: String(data.get('notes')),
            tags: String(data.get('tags'))
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean)
        };
    }

    /**
     *
     */
    async onAiGenerateScene () {
        if (!this.onAiGenerate) {
            return;
        }
        if (this.aiButton) {
            this.aiButton.disabled = true;
        }
        try {
            const suggestion = await this.onAiGenerate(this.currentSceneId, this.getFormPayload());
            if (suggestion && typeof suggestion === 'object') {
                const titleInput = this.form.querySelector('input[name="title"]');
                const descriptionInput = this.form.querySelector('textarea[name="description"]');
                if (typeof suggestion.title === 'string') {
                    titleInput.value = suggestion.title;
                }
                if (typeof suggestion.description === 'string') {
                    descriptionInput.value = suggestion.description;
                }
            }
        } catch (error) {
            console.error('[SceneEditorModal] Failed to generate scene idea:', error);
        } finally {
            if (this.aiButton) {
                this.aiButton.disabled = false;
            }
        }
    }

    /**
     *
     * @param scene
     * @param onSave
     * @param onAiGenerate
     */
    open (scene, onSave, onAiGenerate) {
        this.onSave = onSave;
        this.onAiGenerate = onAiGenerate;
        this.currentSceneId = scene.id;
        const titleInput = this.form.querySelector('input[name="title"]');
        const descriptionInput = this.form.querySelector('textarea[name="description"]');
        const notesInput = this.form.querySelector('textarea[name="notes"]');
        const tagsInput = this.form.querySelector('input[name="tags"]');

        titleInput.value = scene.title;
        descriptionInput.value = scene.description;
        notesInput.value = scene.notes;
        tagsInput.value = scene.tags.join(', ');
        if (this.aiButton) {
            this.aiButton.disabled = !this.onAiGenerate;
        }

        this.modal.classList.remove('hidden');
    }

    /**
     *
     */
    close () {
        this.modal.classList.add('hidden');
        this.onSave = null;
        this.onAiGenerate = null;
        this.currentSceneId = null;
        this.form.reset();
    }
}
