import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { BaseWidget } from '../BaseWidget.js';

import { SceneEditorModal } from './SceneEditorModal.js';

export class SceneBrowserWidget extends BaseWidget {
    constructor () {
        super();
        this.sceneStore = null;
        this.container = null;
        this.gridContainer = null;
        this.modal = null;
        this.modalGrid = null;
        this.editorModal = new SceneEditorModal();
        this.scenes = [];
        this.dragSceneId = null;
        this.editingSceneId = null;
    }

    setSceneStore (sceneStore) {
        this.sceneStore = sceneStore;
    }

    async initialize () {
        await super.initialize();
        this.container = document.querySelector(UI_ELEMENTS.USER_SCENES_PANEL);
        if (!this.container) {
            throw new Error('Scenes container element not found');
        }
        this.container.innerHTML = '';

        this.buildPanel();
        this.buildModal();
        this.setupStateSubscriptions();
    }

    buildPanel () {
        const header = this.createElement('div', 'scene-panel-header');
        const title = this.createElement('h3', 'scene-panel-title', 'Scenes');

        const addButton = this.createElement('button', 'scene-panel-button');
        addButton.type = 'button';
        addButton.textContent = 'Add';
        addButton.addEventListener('click', () => this.openEditor());

        const expandButton = this.createElement('button', 'scene-panel-button');
        expandButton.type = 'button';
        expandButton.textContent = 'Full Screen';
        expandButton.addEventListener('click', () => this.openModal());

        const controls = this.createElement('div', 'scene-panel-controls');
        controls.appendChild(addButton);
        controls.appendChild(expandButton);

        header.appendChild(title);
        header.appendChild(controls);

        this.gridContainer = this.createElement('div', 'scene-grid');
        this.gridContainer.addEventListener('click', this.handleGridClick.bind(this));
        this.gridContainer.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.gridContainer.addEventListener('dragover', this.handleDragOver.bind(this));
        this.gridContainer.addEventListener('drop', this.handleDrop.bind(this));
        this.gridContainer.addEventListener('dragend', this.handleDragEnd.bind(this));

        this.container.appendChild(header);
        this.container.appendChild(this.gridContainer);
    }

    buildModal () {
        this.modal = document.createElement('div');
        this.modal.className = 'scene-browser-modal hidden';
        this.modal.innerHTML = `
            <div class="scene-browser-modal__backdrop"></div>
            <div class="scene-browser-modal__content">
                <header class="scene-browser-modal__header">
                    <h3>Scenes</h3>
                    <div class="scene-browser-modal__controls">
                        <button type="button" class="scene-panel-button" data-action="add">Add</button>
                        <button type="button" class="scene-panel-button" data-action="close">Close</button>
                    </div>
                </header>
                <div class="scene-browser-modal__grid"></div>
            </div>
        `;
        document.body.appendChild(this.modal);
        this.modalGrid = this.modal.querySelector('.scene-browser-modal__grid');
        this.modalGrid.addEventListener('click', this.handleGridClick.bind(this));
        this.modalGrid.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.modalGrid.addEventListener('dragover', this.handleDragOver.bind(this));
        this.modalGrid.addEventListener('drop', this.handleDrop.bind(this));
        this.modalGrid.addEventListener('dragend', this.handleDragEnd.bind(this));

        this.modal.addEventListener('click', (event) => {
            const { target } = event;
            const { action } = target.dataset;
            if (action === 'close' || target.classList.contains('scene-browser-modal__backdrop')) {
                this.closeModal();
            }
            if (action === 'add') {
                this.openEditor();
            }
        });
    }

    setupStateSubscriptions () {
        this.subscribeToState(StateManager.KEYS.SCENES, this.handleScenesUpdate.bind(this));
        this.handleScenesUpdate(this.stateManager.getState(StateManager.KEYS.SCENES));
    }

    handleScenesUpdate (scenes) {
        this.scenes = Array.isArray(scenes) ? scenes : [];
        this.renderScenes(this.gridContainer);
        this.renderScenes(this.modalGrid);
        this.focusInlineEditor(this.gridContainer);
        this.focusInlineEditor(this.modalGrid);
    }

    renderScenes (container) {
        if (!container) {
            return;
        }
        container.innerHTML = '';
        container.style.setProperty('--cols', Math.min(this.scenes.length, 6));
        if (container === this.modalGrid) {
            container.classList.toggle('is-few', this.scenes.length <= 3);
        }
        if (this.scenes.length === 0) {
            const empty = this.createElement('div', 'scene-empty');
            empty.textContent = 'No scenes yet';
            container.appendChild(empty);
            return;
        }
        this.scenes.forEach(scene => {
            const tile = this.createSceneTile(scene);
            container.appendChild(tile);
        });
    }

    createSceneTile (scene) {
        const tile = this.createElement('div', 'scene-tile');
        tile.dataset.sceneId = scene.id;
        tile.draggable = true;

        const title = this.createElement('div', 'scene-tile__title');
        title.dataset.action = 'rename';
        if (this.editingSceneId && String(this.editingSceneId) === String(scene.id)) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'scene-tile__title-input';
            input.value = scene.title;
            input.dataset.action = 'rename-input';
            title.appendChild(input);
        } else {
            title.textContent = scene.title;
        }
        const meta = this.createElement('div', 'scene-tile__meta');
        meta.textContent = Array.isArray(scene.tags) && scene.tags.length
            ? scene.tags.join(', ')
            : 'No tags';

        const actions = this.createElement('div', 'scene-tile__actions');
        actions.innerHTML = `
            <button type="button" data-action="edit" title="Edit">Edit</button>
            <button class="icon-button" type="button" data-action="delete" title="Delete">x</button>
        `;

        tile.appendChild(title);
        tile.appendChild(meta);
        tile.appendChild(actions);

        return tile;
    }

    handleGridClick (event) {
        const { target } = event;
        const { action } = target.dataset;
        if (!action) {
            return;
        }
        const tile = target.closest('.scene-tile');
        if (!tile) {
            return;
        }
        const { sceneId } = tile.dataset;
        if (action === 'edit') {
            const scene = this.scenes.find(item => String(item.id) === String(sceneId));
            if (scene) {
                this.openEditor(scene);
            }
        }
        if (action === 'delete') {
            this.handleDelete(sceneId);
        }
        if (action === 'rename') {
            this.startInlineRename(sceneId);
        }
    }

    focusInlineEditor (container) {
        if (!container || !this.editingSceneId) {
            return;
        }
        const selector = `[data-scene-id="${this.editingSceneId}"] .scene-tile__title-input`;
        const input = container.querySelector(selector);
        if (input) {
            input.focus();
            input.select();
            input.addEventListener('blur', () => {
                this.commitInlineRename(this.editingSceneId, input.value);
            }, { once: true });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.commitInlineRename(this.editingSceneId, input.value);
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.cancelInlineRename();
                }
            }, { once: true });
        }
    }

    startInlineRename (sceneId) {
        this.editingSceneId = sceneId;
        this.renderScenes(this.gridContainer);
        this.renderScenes(this.modalGrid);
    }

    async commitInlineRename (sceneId, value) {
        const scriptId = this.getCurrentScriptId();
        if (!scriptId) {
            this.cancelInlineRename();
            return;
        }
        const trimmed = String(value).trim();
        const scene = this.scenes.find(item => String(item.id) === String(sceneId));
        if (!scene) {
            this.cancelInlineRename();
            return;
        }
        if (!trimmed || trimmed === scene.title) {
            this.cancelInlineRename();
            return;
        }
        try {
            await this.sceneStore.updateScene(scriptId, sceneId, { title: trimmed });
        } catch (error) {
            console.error('[SceneBrowserWidget] Failed to rename scene:', error);
        } finally {
            this.cancelInlineRename();
        }
    }

    cancelInlineRename () {
        this.editingSceneId = null;
        this.renderScenes(this.gridContainer);
        this.renderScenes(this.modalGrid);
    }

    handleDragStart (event) {
        const tile = event.target.closest('.scene-tile');
        if (!tile) {
            return;
        }
        this.dragSceneId = tile.dataset.sceneId;
        tile.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
    }

    handleDragOver (event) {
        const tile = event.target.closest('.scene-tile');
        if (!tile || !this.dragSceneId) {
            return;
        }
        event.preventDefault();
    }

    handleDrop (event) {
        const tile = event.target.closest('.scene-tile');
        if (!tile || !this.dragSceneId) {
            return;
        }
        event.preventDefault();
        const targetId = tile.dataset.sceneId;
        if (String(targetId) === String(this.dragSceneId)) {
            return;
        }
        const nextScenes = this.getReorderedScenes(this.dragSceneId, targetId);
        this.submitReorder(nextScenes);
    }

    handleDragEnd (event) {
        const tile = event.target.closest('.scene-tile');
        if (tile) {
            tile.classList.remove('is-dragging');
        }
        this.dragSceneId = null;
    }

    getReorderedScenes (sourceId, targetId) {
        const list = [...this.scenes];
        const sourceIndex = list.findIndex(scene => String(scene.id) === String(sourceId));
        const targetIndex = list.findIndex(scene => String(scene.id) === String(targetId));
        if (sourceIndex === -1 || targetIndex === -1) {
            return list;
        }
        const [moved] = list.splice(sourceIndex, 1);
        list.splice(targetIndex, 0, moved);
        return list;
    }

    async submitReorder (orderedScenes) {
        const scriptId = this.getCurrentScriptId();
        if (!scriptId) {
            return;
        }
        const order = orderedScenes.map((scene, index) => ({
            sceneId: scene.id,
            sortIndex: index
        }));
        try {
            await this.sceneStore.reorderScenes(scriptId, order);
        } catch (error) {
            console.error('[SceneBrowserWidget] Failed to reorder scenes:', error);
        }
    }

    openEditor (scene) {
        const scriptId = this.getCurrentScriptId();
        if (!scriptId) {
            return;
        }
        const emptyScene = {
            id: null,
            title: '',
            description: '',
            notes: '',
            tags: []
        };
        this.editorModal.open(scene || emptyScene, async(sceneId, payload) => {
            try {
                if (sceneId) {
                    await this.sceneStore.updateScene(scriptId, sceneId, payload);
                } else {
                    await this.sceneStore.createScene(scriptId, payload);
                }
                this.editorModal.close();
            } catch (error) {
                console.error('[SceneBrowserWidget] Failed to save scene:', error);
            }
        }, async(sceneId, draft) => {
            try {
                return await this.sceneStore.generateSceneIdea(scriptId, sceneId, draft);
            } catch (error) {
                console.error('[SceneBrowserWidget] Failed to generate scene idea:', error);
                return null;
            }
        });
    }

    async handleDelete (sceneId) {
        const scriptId = this.getCurrentScriptId();
        if (!scriptId) {
            return;
        }
        try {
            await this.sceneStore.deleteScene(scriptId, sceneId);
        } catch (error) {
            console.error('[SceneBrowserWidget] Failed to delete scene:', error);
        }
    }

    getCurrentScriptId () {
        const script = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        return script ? script.id : null;
    }

    openModal () {
        this.modal.classList.remove('hidden');
        this.renderScenes(this.modalGrid);
    }

    closeModal () {
        this.modal.classList.add('hidden');
    }
}
