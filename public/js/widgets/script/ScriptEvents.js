import { BaseEvents } from '../../core/BaseEvents.js';

export class ScriptEvents extends BaseEvents {
    setupEvents() {
        const { scriptList, scriptEditor } = this.elements;

        // Handle script selection
        if (scriptList) {
            this.addEventListener(scriptList, 'click', (e) => {
                const scriptLink = e.target.closest('.script-link');
                if (scriptLink) {
                    e.preventDefault();
                    const scriptId = scriptLink.getAttribute('data-script-id');
                    this.handlers.handleScriptSelect(scriptId);
                }
            });
        }

        // Handle script editor save
        if (scriptEditor) {
            const saveButton = scriptEditor.querySelector('.save-button');
            if (saveButton) {
                this.addEventListener(saveButton, 'click', (e) => {
                    e.preventDefault();
                    this.handleScriptSave();
                });
            }
        }
    }

    handleScriptSave() {
        const { scriptEditor } = this.elements;
        if (!scriptEditor) return;

        const titleInput = scriptEditor.querySelector('.script-title');
        const descriptionTextarea = scriptEditor.querySelector('.script-description');
        const contentTextarea = scriptEditor.querySelector('.script-content');

        const scriptData = {
            title: titleInput.value.trim(),
            description: descriptionTextarea.value.trim(),
            content: contentTextarea.value.trim()
        };

        this.handlers.handleScriptSave(scriptData);
    }
}