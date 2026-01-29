import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { ScriptOrchestrator } from '../../services/script/ScriptOrchestrator.js';
import { ScriptSyncService } from '../../services/script/ScriptSyncService.js';

export const ORCHESTRATOR_STATE = {
    IDLE: 'idle',
    WAITING_FOR_EDITOR: 'waiting_for_editor',
    WAITING_FOR_SCRIPT: 'waiting_for_script',
    READY: 'ready'
};

export class OrchestratorLifecycleController {
    #state = ORCHESTRATOR_STATE.IDLE;
    #subscriptionsWired = false;
    #orchestrator = null;

    constructor ({ scriptStore, eventManager, stateManager, registry }) {
        this.scriptStore = scriptStore;
        this.eventManager = eventManager;
        this.stateManager = stateManager;
        this.registry = registry;
    }

    start () {
        if (this.#state !== ORCHESTRATOR_STATE.IDLE) return;
        this.#state = ORCHESTRATOR_STATE.WAITING_FOR_EDITOR;
        this.#wireListeners();
        this.#refresh();
    }

    #wireListeners () {
        if (this.#subscriptionsWired) return;
        this.#subscriptionsWired = true;

        this.eventManager.subscribe(EventManager.EVENTS.EDITOR.EDITOR_AREA_READY, () => {
            this.stateManager.setState(StateManager.KEYS.EDITOR_READY, true);
            this.#refresh();
        });

        this.eventManager.subscribe(EventManager.EVENTS.SCRIPT.SELECTED, () => {
            this.#refresh();
        });
    }

    #refresh () {
        const scriptsUI = this.registry.get('scriptsUI');
        const chat = this.registry.get('chat');
        const editorWidget = scriptsUI.getEditorWidget();

        if (!editorWidget || !scriptsUI.isEditorReady()) {
            this.#state = ORCHESTRATOR_STATE.WAITING_FOR_EDITOR;
            return;
        }

        const currentScriptId = this.scriptStore.getCurrentScriptId();
        if (!currentScriptId) {
            this.#state = ORCHESTRATOR_STATE.WAITING_FOR_SCRIPT;
            return;
        }

        if (!this.#orchestrator) {
            this.#orchestrator = this.#buildOrchestrator(editorWidget);
            this.registry.register('orchestrator', this.#orchestrator);
        }

        this.#state = ORCHESTRATOR_STATE.READY;

        if (typeof chat.setScriptOrchestrator === 'function') {
            chat.setScriptOrchestrator(this.#orchestrator);
        }
    }

    #buildOrchestrator (editorWidget) {
        const syncService = new ScriptSyncService(this.scriptStore, this.eventManager);
        return new ScriptOrchestrator(
            this.scriptStore,
            syncService,
            editorWidget.container,
            editorWidget
        );
    }
}
