import { StateManager } from './StateManager.js';

/**
 * Base class for all managers with common state and operation handling
 */
export class BaseManager {
    /**
     *
     * @param stateManager
     */
    constructor (stateManager) {
        if (!stateManager) {
            throw new Error('StateManager is required for BaseManager');
        }
        this.stateManager = stateManager;
        this.renderer = null;
        this.events = null;
        this.elements = null;
    }

    /**
     *
     * @param elements
     */
    initialize (elements) {
        if (!elements) {
            throw new Error('UI elements are required for initialization');
        }
        this.elements = elements;
    }

    /**
     *
     * @param data
     */
    update (data) {
        if (this.renderer && data) {
            this.renderer.render(data);
        }
    }

    /**
     *
     * @param renderer
     */
    setRenderer (renderer) {
        if (!renderer) {
            throw new Error('Renderer is required');
        }
        this.renderer = renderer;
    }

    /**
     *
     * @param events
     */
    setEvents (events) {
        if (!events) {
            throw new Error('Events are required');
        }
        this.events = events;
    }

    /**
     *
     * @param loading
     */
    setLoading (loading) {
        if (this.stateManager) {
            this.stateManager.setState(StateManager.KEYS.LOADING, loading);
        }
    }

    /**
     *
     * @param error
     * @param context
     */
    handleError (error, context) {
        if (!error) {
            console.warn('No error provided to handleError');
            return;
        }
        console.error(`Error in ${context}:`, error);
        if (this.stateManager) {
            this.stateManager.setState(StateManager.KEYS.ERROR, error);
        }
    }

    /**
     *
     */
    destroy () {
        this.renderer = null;
        this.events = null;
        this.elements = null;
    }
}
